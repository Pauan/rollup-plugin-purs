use std::convert::TryInto;

#[macro_use]
mod combinators;
pub use combinators::*;

mod stream;
pub use stream::*;

pub mod ast;
use ast::Location;


const HEX_DIGIT_ERROR: &'static str = "Expected one of [0 1 2 3 4 5 6 7 8 9 a b c d e f A B C D E F]";


pub fn hex_to_char(s: &str) -> Option<char> {
    let decoded = match u32::from_str_radix(s, 16) {
        Ok(s) => s,
        // TODO handle things like overflow
        Err(_) => unreachable!(),
    };

    decoded.try_into().ok()
}


// https://www.ecma-international.org/ecma-262/10.0/#prod-IdentifierStart
fn is_identifier_start(c: char) -> bool {
    match c {
        '$' => true,
        '_' => true,
        '\\' => true,
        // TODO use ID_Start instead of XID_Start ?
        c if unicode_xid::UnicodeXID::is_xid_start(c) => true,
        _ => false,
    }
}

// https://www.ecma-international.org/ecma-262/10.0/#prod-IdentifierPart
fn is_identifier_part(c: char) -> bool {
    // '\' is excluded because it's handled in parse_identifier
    match c {
        '$' => true,
        '\u{200C}' => true,
        '\u{200D}' => true,
        // TODO use ID_Continue instead of XID_Continue ?
        c if unicode_xid::UnicodeXID::is_xid_continue(c) => true,
        _ => false,
    }
}

// https://www.ecma-international.org/ecma-262/10.0/#sec-white-space
fn is_whitespace(c: char) -> bool {
    match c {
        '\u{0009}' |
        '\u{000B}' |
        '\u{000C}' |
        '\u{0020}' |
        '\u{00A0}' |
        '\u{FEFF}' |
        '\u{1680}' |
        '\u{2000}'..='\u{200A}' |
        '\u{202F}' |
        '\u{205F}' |
        '\u{3000}' => true,
        _ => false,
    }
}


// Good:  {}
// Good:  {foo}
// Good:  {foo,}
// Good:  {foo,bar}
// Good:  {foo,bar,}
//  Bad:  {,}
//  Bad:  {foo bar}
//  Bad:  {foo,,}
fn separated_list<A, F>(p: &mut TextStream, left: char, right: char, message: &str, mut f: F) -> ParseResult<Vec<A>, ParseError>
    where F: FnMut(&mut TextStream) -> ParseResult<A, ParseError> {
    let start = p.position();

    char(p, left)?;

    let mut seen = false;

    many0(|| {
        parse_whitespace(p)?;

        // TODO new alt combinator for this ?
        alt!(p,
            |p| {
                char(p, right)?;
                Ok(None)
            },
            |p| {
                if seen {
                    on_fail(p,
                        |p| {
                            char(p, ',')?;
                            parse_whitespace(p)
                        },
                        |p| p.error(start, "Expected ,"),
                    )?;
                }

                on_fail(p,
                    |p| alt!(p,
                        |p| {
                            if seen {
                                char(p, right)?;
                                Ok(None)

                            } else {
                                Err(None)
                            }
                        },
                        |p| {
                            let value = f(p)?;
                            seen = true;
                            Ok(Some(value))
                        },
                    ),
                    |p| p.error(start, &format!("Expected {} or {}", message, right)),
                )
            },
        )
    })
}


fn is_number_or_identifier(p: &mut TextStream) -> ParseResult<bool, ParseError> {
    if let Some(_) = peek(p, |p| char_if(p, |c| c.is_ascii_digit() || is_identifier_start(c)))? {
        Ok(true)

    } else {
        Ok(false)
    }
}


fn parse_hex_digit(p: &mut TextStream) -> ParseResult<(), ParseError> {
    error(p, |p| void(|| char_if(p, |c| c.is_ascii_hexdigit())), HEX_DIGIT_ERROR)
}


fn parse_unicode_code_point(p: &mut TextStream, start: Position, end: Position) -> ParseResult<char, ParseError> {
    match hex_to_char(p.slice(start.offset, end.offset)) {
        Some(c) => Ok(c),
        None => Err(Some(p.error(start, "Invalid Unicode code point"))),
    }
}

// https://www.ecma-international.org/ecma-262/10.0/#prod-UnicodeEscapeSequence
fn parse_unicode_escape_sequence(p: &mut TextStream) -> ParseResult<char, ParseError> {
    alt!(p,
        |p| {
            char(p, '{')?;

            let start = p.position();

            on_fail(p,
                |p| each1(|| alt_opt!(p,
                    |p| void(|| char_if(p, |c| c.is_ascii_hexdigit())),
                )),
                // TODO test the position
                |p| p.error(start, HEX_DIGIT_ERROR),
            )?;

            let end = p.position();

            on_fail(p,
                |p| char(p, '}'),
                |p| p.error(end, "Expected }"),
            )?;

            // TODO check the MV ?
            parse_unicode_code_point(p, start, end)
        },
        |p| {
            let start = p.position();

            parse_hex_digit(p)?;
            parse_hex_digit(p)?;
            parse_hex_digit(p)?;
            parse_hex_digit(p)?;

            let end = p.position();

            parse_unicode_code_point(p, start, end)
        },
    )
}


fn parse_escape(p: &mut TextStream, start: Position) -> ParseResult<(), ParseError> {
    on_fail(p,
        |p| alt!(p,
            |p| {
                char(p, 'u')?;
                void(|| parse_unicode_escape_sequence(p))
            },
            // TODO validation for this ?
            |p| {
                char(p, 'x')?;
                parse_hex_digit(p)?;
                parse_hex_digit(p)
            },
            |p| {
                char(p, '0')?;

                if let Some(_) = peek(p, |p| char_if(p, |c| c.is_ascii_digit()))? {
                    return Err(Some(p.error(start, "\\0 cannot be followed by a number")));
                }

                Ok(())
            },
            // TODO allow for 8 and 9 ?
            |p| {
                char_if(p, |c| c.is_ascii_digit())?;
                Err(Some(p.error(start, "\\ cannot be followed by a number")))
            },
            any_char,
        ),
        |p| p.error(start, "Missing escape sequence")
    )
}


fn parse_string_delimiter<'a, 'b>(p: &mut TextStream<'a, 'b>, delimiter: char) -> ParseResult<ast::String<'a>, ParseError> {
    let start = p.position();

    char(p, delimiter)?;

    on_fail(p,
        |p| each0(|| alt!(p,
            |p| {
                char(p, delimiter)?;
                Ok(None)
            },
            |p| {
                let start = p.position();
                char(p, '\\')?;
                parse_escape(p, start)?;
                Ok(Some(()))
            },
            |p| {
                let start = p.position();
                // TODO allow for '\u{2028}' and '\u{2029}'
                char(p, '\n')?;
                Err(Some(p.error(start, "Strings may not contain newlines except after \\")))
            },
            |p| {
                any_char(p)?;
                Ok(Some(()))
            },
        )),
        |p| p.error(start, &format!("Missing ending {}", delimiter))
    )?;

    let end = p.position();

    Ok(ast::String {
        raw_value: p.slice(start.offset, end.offset),
        location: Location { start, end }
    })
}

fn parse_string<'a, 'b>(p: &mut TextStream<'a, 'b>) -> ParseResult<ast::String<'a>, ParseError> {
    alt!(p,
        |p| parse_string_delimiter(p, '"'),
        |p| parse_string_delimiter(p, '\''),
    )
}


fn parse_line_comment(p: &mut TextStream) -> ParseResult<(), ParseError> {
    char(p, '/')?;
    char(p, '/')?;
    each0(|| alt_opt!(p,
        |p| void(|| char_if(p, |c| c != '\n')),
    ))
}

fn parse_block_comment(p: &mut TextStream) -> ParseResult<(), ParseError> {
    let start = p.position();

    char(p, '/')?;
    char(p, '*')?;

    on_fail(p,
        |p| each0(|| alt!(p,
            |p| {
                char(p, '*')?;
                char(p, '/')?;
                Ok(None)
            },
            |p| {
                any_char(p)?;
                Ok(Some(()))
            },
        )),
        |p| p.error(start, "Missing ending */"),
    )
}

fn parse_whitespace(p: &mut TextStream) -> ParseResult<(), ParseError> {
    each0(|| alt_opt!(p,
        |p| char(p, '\n'),
        |p| void(|| char_if(p, is_whitespace)),
        parse_line_comment,
        parse_block_comment,
    ))
}


fn parse_regexp<'a>(p: &mut TextStream<'a, '_>) -> ParseResult<ast::RegExp<'a>, ParseError> {
    let start = p.position();

    char(p, '/')?;

    on_fail(p,
        |p| each0(|| alt!(p,
            |p| {
                char(p, '/')?;
                Ok(None)
            },
            |p| {
                let start = p.position();

                char(p, '\\')?;

                on_fail(p,
                    |p| alt!(p,
                        |p| {
                            let start = p.position();
                            char(p, '\n')?;
                            return Err(Some(p.error(start, "RegExps may not contain newlines")));
                        },
                        any_char,
                    ),
                    |p| p.error(start, "Missing escape sequence"),
                )?;

                Ok(Some(()))
            },
            // TODO code duplication
            |p| {
                let start = p.position();
                char(p, '\n')?;
                return Err(Some(p.error(start, "RegExps may not contain newlines")));
            },
            |p| {
                any_char(p)?;
                Ok(Some(()))
            },
        )),
        |p| p.error(start, "Missing ending /"),
    )?;

    let pattern_end = p.position();

    let raw_pattern = p.slice(start.offset, pattern_end.offset);

    each0(|| alt_opt!(p,
        |p| void(|| char_if(p, |c| c.is_ascii_lowercase())),
    ))?;

    let end = p.position();

    if is_number_or_identifier(p)? {
        return Err(Some(p.error(end, "RegExp cannot be followed by a number or identifier")));
    }

    let raw_flags = p.slice(pattern_end.offset, end.offset);

    Ok(ast::RegExp {
        raw_pattern,
        raw_flags,
        location: Location { start, end },
    })
}


fn parse_template<'a>(p: &mut TextStream<'a, '_>, tag: Option<Box<ast::Expression<'a>>>) -> ParseResult<ast::Template<'a>, ParseError> {
    let start = p.position();

    char(p, '`')?;

    let mut parts = vec![];
    let mut part_start = p.position();

    on_fail(p,
        |p| each0(|| {
            let end = p.position();

            alt!(p,
                |p| {
                    char(p, '`')?;

                    parts.push(ast::TemplatePart::TemplateRaw(ast::TemplateRaw {
                        raw_value: p.slice(part_start.offset, end.offset),
                        location: Location { start: part_start, end },
                    }));

                    Ok(None)
                },
                |p| {
                    char(p, '\\')?;

                    on_fail(p,
                        any_char,
                        |p| p.error(end, "Missing escape sequence"),
                    )?;

                    Ok(Some(()))
                },
                |p| {
                    char(p, '$')?;

                    alt!(p,
                        |p| {
                            char(p, '{')?;

                            parts.push(ast::TemplatePart::TemplateRaw(ast::TemplateRaw {
                                raw_value: p.slice(part_start.offset, end.offset),
                                location: Location { start: part_start, end },
                            }));

                            parse_whitespace(p)?;

                            let expr = parse_expression(p)?;

                            parse_whitespace(p)?;

                            error(p, |p| char(p, '}'), "Expected }")?;

                            part_start = p.position();

                            parts.push(ast::TemplatePart::Expression(expr));

                            Ok(Some(()))
                        },
                        |p| {
                            // TODO is this correct ?
                            Ok(Some(()))
                        },
                    )
                },
                |p| {
                    any_char(p)?;
                    Ok(Some(()))
                },
            )
        }),
        |p| p.error(start, "Missing ending `"),
    )?;

    let end = p.position();

    Ok(ast::Template {
        tag,
        parts,
        location: Location { start, end },
    })
}


fn parse_identifier_unicode<F>(p: &mut TextStream, start: Position, f: F) -> ParseResult<(), ParseError> where F: FnOnce(char) -> bool {
    error(p, |p| char(p, 'u'), "Expected u")?;

    if f(parse_unicode_escape_sequence(p)?) {
        Ok(())

    } else {
        Err(Some(p.error(start, "Invalid Unicode code point for identifier")))
    }
}

// https://www.ecma-international.org/ecma-262/10.0/#prod-IdentifierName
fn parse_identifier<'a>(p: &mut TextStream<'a, '_>) -> ParseResult<ast::Identifier<'a>, ParseError> {
    let start = p.position();

    let c = char_if(p, is_identifier_start)?;

    if c == '\\' {
        parse_identifier_unicode(p, start, is_identifier_start)?;
    }

    each0(|| alt_opt!(p,
        |p| {
            char_if(p, is_identifier_part)?;
            Ok(())
        },
        |p| {
            let start = p.position();
            char(p, '\\')?;
            parse_identifier_unicode(p, start, is_identifier_part)?;
            Ok(())
        },
    ))?;

    let end = p.position();

    Ok(ast::Identifier {
        raw_value: p.slice(start.offset, end.offset),
        location: Location { start, end },
    })
}

fn parse_binding_identifier<'a>(p: &mut TextStream<'a, '_>) -> ParseResult<ast::Identifier<'a>, ParseError> {
    let ident = parse_identifier(p)?;

    if ident.is_reserved_word() {
        Err(Some(p.error(ident.location.start, "Cannot use reserved word as variable")))

    } else {
        Ok(ident)
    }
}


fn parse_keyword(p: &mut TextStream, name: &str) -> ParseResult<(), ParseError> {
    eq(p, name)?;

    // TODO is this correct ?
    if let Some(_) = peek(p, |p| char_if(p, |c| c == '\\' || is_identifier_part(c)))? {
        Err(None)

    } else {
        Ok(())
    }
}



fn parse_decimal_digits0(p: &mut TextStream) -> ParseResult<(), ParseError> {
    each0(|| alt_opt!(p,
        |p| void(|| char_if(p, |c| c.is_ascii_digit())),
    ))
}

fn parse_decimal_digits1(p: &mut TextStream) -> ParseResult<(), ParseError> {
    error(p,
        |p| each1(|| alt_opt!(p,
            |p| void(|| char_if(p, |c| c.is_ascii_digit())),
        )),
        "Expected one of [0 1 2 3 4 5 6 7 8 9]",
    )
}

fn parse_decimal_number(p: &mut TextStream) -> ParseResult<(), ParseError> {
    optional(p, |p| {
        char(p, '.')?;
        parse_decimal_digits0(p)
    })?;

    optional(p, parse_exponent_part)?;

    Ok(())
}

fn parse_exponent_part(p: &mut TextStream) -> ParseResult<(), ParseError> {
    char_if(p, |c| c == 'e' || c == 'E')?;
    optional(p, |p| char_if(p, |c| c == '+' || c == '-'))?;
    parse_decimal_digits1(p)
}

fn parse_after_number(p: &mut TextStream) -> ParseResult<(), ParseError> {
    let start = p.position();

    if is_number_or_identifier(p)? {
        return Err(Some(p.error(start, "Number cannot be followed by a number or identifier")));
    }

    Ok(())
}


fn parse_module<'a>(p: &mut TextStream<'a, '_>) -> ParseResult<ast::Module<'a>, ParseError> {
    let statements = many0(|| {
        parse_whitespace(p)?;

        alt!(p,
            |p| {
                parse_keyword(p, "import")?;
                parse_whitespace(p)?;

                /*error(
                    alt!(
                        |p| {
                            char('*')(p)?;
                            parse_whitespace(p)?;
                            error(|p| parse_keyword(p, "as"), "Expected as")(p)?;
                            parse_whitespace(p)?;
                            let ident = parse_binding_identifier(p)?;
                        },
                        |p| {
                            let specifiers = separated_list('{', '}', "", eof)(p)?;
                        },
                        |p| {
                            let ident = parse_identifier(p)?;


                        },
                    ),
                    "Expected * or { or identifier or string",
                )(p)?;

                Ok(Some(ast::ModuleStatement::Import {
                    specifiers,
                    filename,
                }))*/

                Ok(None)
            },
            |p| {
                parse_keyword(p, "export")?;
                Ok(None)
            },
            |p| {
                let statement = parse_statement(p)?;
                Ok(Some(ast::ModuleStatement::Statement(statement)))
            },
            |p| {
                error(p, eof, "Unexpected token")?;
                Ok(None)
            },
        )
    })?;

    Ok(ast::Module { statements })
}


pub fn parse_as_module<'a, 'b>(input: &'a str, filename: Option<&'b str>) -> Result<ast::Module<'a>, ParseError> {
    let mut p = TextStream::new(input, filename);

    match parse_module(&mut p) {
        Ok(s) => Ok(s),
        Err(Some(e)) => Err(e),
        Err(None) => unreachable!(),
    }
}


/*#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;
    use std::fs::{File, read_dir};
    use std::io::{Read, BufReader};

    fn read(s: &str) -> String {
        let file = File::open(s).unwrap();
        let mut buf_reader = BufReader::new(file);
        let mut contents = String::new();
        buf_reader.read_to_string(&mut contents).unwrap();
        contents
    }

    fn each_file<F>(path: &str, mut f: F) where F: FnMut(&str, &Path) {
        for file in read_dir(path).unwrap() {
            let filename = file.unwrap().path();
            f(&read(filename.to_str().unwrap()), &filename);
        }
    }

    #[test]
    fn test_empty() {
        assert_eq!(Parser::new("", Some("foo.js")).parse_as_module(), Ok(Module {
            statements: vec![],
        }));

        assert_eq!(Parser::new(" \n \n  \n   ", Some("foo.js")).parse_as_module(), Ok(Module {
            statements: vec![],
        }));
    }

    #[test]
    fn test_whitespace() {
        assert_eq!(Parser::new("\n\n\n      \"use strict\"\ntest", Some("foo.js")).parse_as_module(), Ok(Module {
            statements: vec![
                Span {
                    value: ModuleStatement::Statement(Statement::Expression(Span {
                        value: Expression::Literal(Literal::String(StringLiteral {
                            raw_value: "\"use strict\""
                        })),
                        start: Position { offset: 9, line: 3, column: 6 },
                        end: Position { offset: 21, line: 3, column: 18 },
                    })),
                    start: Position { offset: 9, line: 3, column: 6 },
                    end: Position { offset: 22, line: 4, column: 0 },
                },
                Span {
                    value: ModuleStatement::Statement(Statement::Expression(Span {
                        value: Expression::Identifier(Identifier { name: "test" }),
                        start: Position { offset: 22, line: 4, column: 0 },
                        end: Position { offset: 26, line: 4, column: 4 },
                    })),
                    start: Position { offset: 22, line: 4, column: 0 },
                    end: Position { offset: 26, line: 4, column: 4 },
                },
            ],
        }));
    }

    #[test]
    fn test_import() {
        assert_eq!(Parser::new("\n\n   \n     import \"bar\"", Some("foo.js")).parse_as_module(), Ok(Module {
            statements: vec![
                Span {
                    value: ModuleStatement::Import {
                        specifiers: vec![],
                        filename: Span {
                            value: StringLiteral {
                                raw_value: "\"bar\"",
                            },
                            start: Position { offset: 18, line: 3, column: 12 },
                            end: Position { offset: 23, line: 3, column: 17 },
                        }
                    },
                    start: Position { offset: 11, line: 3, column: 5 },
                    end: Position { offset: 23, line: 3, column: 17, },
                },
            ],
        }));

        assert_eq!(Parser::new("\n\n   \n      import 1 from \"bar\";\n", Some("foo.js")).parse_as_module(), Ok(Module {
            statements: vec![],
        }));
    }

    #[test]
    fn test_official_pass() {
        each_file("test/test-cases/pass", |file, filename| {
            let explicit_filename = format!("test/test-cases/pass-explicit/{}", filename.file_name().unwrap().to_str().unwrap());
            let explicit = read(&explicit_filename);

            let normal = Parser::new(file, Some(filename.to_str().unwrap())).parse_as_module().unwrap();
            let explicit = Parser::new(&explicit, Some(&explicit_filename)).parse_as_module().unwrap();

            assert_eq!(normal, explicit);
        });
    }

    #[test]
    fn test_official_fail() {
        each_file("test/test-cases/fail", |file, filename| {
            assert!(Parser::new(file, Some(filename.to_str().unwrap())).parse_as_module().is_err());
        });
    }

    #[test]
    fn test_official_early() {
        each_file("test/test-cases/early", |file, filename| {
            assert!(Parser::new(file, Some(filename.to_str().unwrap())).parse_as_module().is_err());
        });
    }
}
*/
