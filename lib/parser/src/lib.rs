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
fn separated_list<P, A, F, S>(p: &mut P, left: char, mut f: F, mut sep: S, right: char) -> ParseResult<Vec<A>, P::Error>
    where P: Parser,
          S: FnMut(&mut P) -> ParseResult<(), P::Error>,
          F: FnMut(&mut P) -> ParseResult<A, P::Error> {
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
                    sep(p)?;
                }

                alt!(p,
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
                )
            },
        )
    })
}


fn is_number_or_identifier<P>(p: &mut P) -> ParseResult<bool, P::Error> where P: Parser {
    if let Some(_) = peek(p, |p| char_if(p, |c| c.is_ascii_digit() || is_identifier_start(c)))? {
        Ok(true)

    } else {
        Ok(false)
    }
}


fn parse_hex_digit<P>(p: &mut P) -> ParseResult<(), P::Error> where P: Parser {
    error(p, |p| void(|| char_if(p, |c| c.is_ascii_hexdigit())), HEX_DIGIT_ERROR)
}


fn parse_unicode_code_point<'a, P>(p: &mut P, start: Position, end: Position) -> ParseResult<char, P::Error> where P: Parser<Slice = &'a str> {
    match hex_to_char(p.slice(start.offset, end.offset)) {
        Some(c) => Ok(c),
        None => Err(Some(p.error(start, "Invalid Unicode code point"))),
    }
}

// https://www.ecma-international.org/ecma-262/10.0/#prod-UnicodeEscapeSequence
fn parse_unicode_escape_sequence<'a, P>(p: &mut P) -> ParseResult<char, P::Error> where P: Parser<Slice = &'a str> {
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


fn parse_escape<'a, P>(p: &mut P, start: Position) -> ParseResult<(), P::Error> where P: Parser<Slice = &'a str> {
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


fn parse_line_comment<P>(p: &mut P) -> ParseResult<(), P::Error> where P: Parser {
    char(p, '/')?;
    char(p, '/')?;
    each0(|| alt_opt!(p,
        |p| void(|| char_if(p, |c| c != '\n')),
    ))
}

fn parse_block_comment<P>(p: &mut P) -> ParseResult<(), P::Error> where P: Parser {
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

fn parse_whitespace<P>(p: &mut P) -> ParseResult<(), P::Error> where P: Parser {
    each0(|| alt_opt!(p,
        |p| char(p, '\n'),
        |p| void(|| char_if(p, is_whitespace)),
        parse_line_comment,
        parse_block_comment,
    ))
}

fn parse_semicolon<P>(p: &mut P) -> ParseResult<(), P::Error> where P: Parser {
    let start = p.position();

    parse_whitespace(p)?;

    alt!(p,
        |p| eof(p),
        |p| char(p, ';'),
        |p| {
            let end = p.position();

            // This compares the position so that way it will work even for block comments
            if end.line > start.line {
                Ok(())

            } else {
                Err(Some(p.error(start, "Expected ; or newline")))
            }
        },
    )
}


fn parse_string_delimiter<'a, P>(p: &mut P, delimiter: char) -> ParseResult<ast::String<'a>, P::Error> where P: Parser<Slice = &'a str> {
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

fn parse_string<'a, P>(p: &mut P) -> ParseResult<ast::String<'a>, P::Error> where P: Parser<Slice = &'a str> {
    alt!(p,
        |p| parse_string_delimiter(p, '"'),
        |p| parse_string_delimiter(p, '\''),
    )
}


fn parse_regexp<'a, P>(p: &mut P) -> ParseResult<ast::RegExp<'a>, P::Error> where P: Parser<Slice = &'a str> {
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


fn parse_template<'a, P>(p: &mut P, tag: Option<Box<ast::Expression<'a>>>) -> ParseResult<ast::Template<'a>, P::Error> where P: Parser<Slice = &'a str> {
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
                        |p| any_char(p),
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
                        |_| {
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


fn parse_identifier_unicode<'a, P, F>(p: &mut P, start: Position, f: F) -> ParseResult<(), P::Error>
    where P: Parser<Slice = &'a str>,
          F: FnOnce(char) -> bool {

    error(p, |p| char(p, 'u'), "Expected u")?;

    if f(parse_unicode_escape_sequence(p)?) {
        Ok(())

    } else {
        Err(Some(p.error(start, "Invalid Unicode code point for identifier")))
    }
}

// https://www.ecma-international.org/ecma-262/10.0/#prod-IdentifierName
fn parse_identifier<'a, P>(p: &mut P) -> ParseResult<ast::Identifier<'a>, P::Error> where P: Parser<Slice = &'a str> {
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

fn assert_not_reserved_word<P>(p: &mut P, ident: &ast::Identifier) -> ParseResult<(), P::Error> where P: Parser {
    if ident.is_reserved_word() {
        Err(Some(p.error(ident.location.start, "Cannot use reserved word as variable")))

    } else {
        Ok(())
    }
}

fn parse_binding_identifier<'a, P>(p: &mut P) -> ParseResult<ast::Identifier<'a>, P::Error> where P: Parser<Slice = &'a str> {
    let ident = parse_identifier(p)?;
    assert_not_reserved_word(p, &ident)?;
    Ok(ident)
}


fn parse_keyword<P>(p: &mut P, name: &str) -> ParseResult<(), P::Error> where P: Parser {
    eq(p, name)?;

    // TODO is this correct ?
    if let Some(_) = peek(p, |p| char_if(p, |c| c == '\\' || is_identifier_part(c)))? {
        Err(None)

    } else {
        Ok(())
    }
}



fn parse_decimal_digits0<P>(p: &mut P) -> ParseResult<(), P::Error> where P: Parser {
    each0(|| alt_opt!(p,
        |p| void(|| char_if(p, |c| c.is_ascii_digit())),
    ))
}

fn parse_decimal_digits1<P>(p: &mut P) -> ParseResult<(), P::Error> where P: Parser {
    error(p,
        |p| each1(|| alt_opt!(p,
            |p| void(|| char_if(p, |c| c.is_ascii_digit())),
        )),
        "Expected one of [0 1 2 3 4 5 6 7 8 9]",
    )
}

fn parse_decimal_number<P>(p: &mut P) -> ParseResult<(), P::Error> where P: Parser {
    optional(p, |p| {
        char(p, '.')?;
        parse_decimal_digits0(p)
    })?;

    optional(p, parse_exponent_part)?;

    Ok(())
}

fn parse_exponent_part<P>(p: &mut P) -> ParseResult<(), P::Error> where P: Parser {
    char_if(p, |c| c == 'e' || c == 'E')?;
    optional(p, |p| char_if(p, |c| c == '+' || c == '-'))?;
    parse_decimal_digits1(p)
}

fn parse_after_number<P>(p: &mut P) -> ParseResult<(), P::Error> where P: Parser {
    let start = p.position();

    if is_number_or_identifier(p)? {
        return Err(Some(p.error(start, "Number cannot be followed by a number or identifier")));
    }

    Ok(())
}


fn parse_expression<'a, P>(p: &mut P) -> ParseResult<ast::Expression<'a>, P::Error> where P: Parser {
    unimplemented!();
}


fn parse_statement<'a, P>(p: &mut P) -> ParseResult<ast::Statement<'a>, P::Error> where P: Parser {
    unimplemented!();
}


fn parse_from_clause<'a, P>(p: &mut P) -> ParseResult<ast::String<'a>, P::Error> where P: Parser<Slice = &'a str> {
    parse_keyword(p, "from")?;
    parse_whitespace(p)?;
    let filename = parse_string(p)?;
    parse_semicolon(p)?;
    Ok(filename)
}

fn parse_specifier<'a, P>(p: &mut P) -> ParseResult<ast::Specifier<'a>, P::Error> where P: Parser<Slice = &'a str> {
    let external = parse_identifier(p)?;

    let local = optional(p, |p| {
        parse_whitespace(p)?;
        parse_keyword(p, "as")?;
        parse_whitespace(p)?;
        error(p, |p| parse_binding_identifier(p), "Expected identifier")
    })?;

    if let Some(local) = local {
        Ok(ast::Specifier { external: Some(external), local })

    } else {
        assert_not_reserved_word(p, &external)?;
        Ok(ast::Specifier { external: None, local: external })
    }
}

fn parse_named_imports<'a, P>(p: &mut P, start: Position, default: Option<ast::Identifier<'a>>) -> ParseResult<ast::ModuleStatement<'a>, P::Error>
    where P: Parser<Slice = &'a str> {

    let specifiers = separated_list(p,
        '{',
        |p| error(p, |p| parse_specifier(p), "Expected identifier or }"),
        |p| {
            error(p, |p| char(p, ','), "Expected , or }")?;
            parse_whitespace(p)
        },
        '}',
    )?;

    parse_whitespace(p)?;
    let filename = parse_from_clause(p)?;

    let end = p.position();

    Ok(ast::ModuleStatement::Import {
        default,
        namespace: None,
        specifiers,
        filename,
        location: Location { start, end },
    })
}

fn parse_namespace_import<'a, P>(p: &mut P, start: Position, default: Option<ast::Identifier<'a>>) -> ParseResult<ast::ModuleStatement<'a>, P::Error>
    where P: Parser<Slice = &'a str> {

    char(p, '*')?;
    parse_whitespace(p)?;
    error(p, |p| parse_keyword(p, "as"), "Expected as")?;
    parse_whitespace(p)?;
    let namespace = error(p, |p| parse_binding_identifier(p), "Expected identifier")?;
    parse_whitespace(p)?;
    let filename = parse_from_clause(p)?;

    let end = p.position();

    Ok(ast::ModuleStatement::Import {
        default,
        namespace: Some(namespace),
        specifiers: vec![],
        filename,
        location: Location { start, end },
    })
}


fn parse_import<'a, P>(p: &mut P) -> ParseResult<ast::ModuleStatement<'a>, P::Error> where P: Parser<Slice = &'a str> {
    let start = p.position();

    parse_keyword(p, "import")?;
    parse_whitespace(p)?;

    error(p,
        |p| alt!(p,
            |p| parse_namespace_import(p, start, None),
            |p| parse_named_imports(p, start, None),
            |p| {
                let filename = parse_string(p)?;
                parse_semicolon(p)?;

                let end = p.position();

                Ok(ast::ModuleStatement::Import {
                    default: None,
                    namespace: None,
                    specifiers: vec![],
                    filename,
                    location: Location { start, end },
                })
            },
            |p| {
                let default = parse_binding_identifier(p)?;

                parse_whitespace(p)?;

                alt!(p,
                    |p| {
                        char(p, ',')?;
                        parse_whitespace(p)?;

                        error(p,
                            |p| alt!(p,
                                // TODO figure out a way to avoid the clone ?
                                |p| parse_namespace_import(p, start, Some(default.clone())),
                                |p| parse_named_imports(p, start, Some(default.clone())),
                            ),
                            "Expected * or {",
                        )
                    },
                    |p| {
                        let filename = parse_from_clause(p)?;

                        let end = p.position();

                        Ok(ast::ModuleStatement::Import {
                            default: Some(default),
                            namespace: None,
                            specifiers: vec![],
                            filename,
                            location: Location { start, end },
                        })
                    },
                )
            },
        ),
        "Expected * or { or identifier or string",
    )
}


fn parse_module<'a, P>(p: &mut P) -> ParseResult<ast::Module<'a>, P::Error> where P: Parser<Slice = &'a str> {
    let statements = many0(|| {
        parse_whitespace(p)?;

        error(p,
            |p| alt!(p,
                |p| {
                    eof(p)?;
                    Ok(None)
                },
                |p| {
                    let value = parse_import(p)?;
                    Ok(Some(value))
                },
                |p| {
                    parse_keyword(p, "export")?;
                    Ok(None)
                },
                |p| {
                    let statement = parse_statement(p)?;
                    Ok(Some(ast::ModuleStatement::Statement(statement)))
                },
            ),
            "Unexpected token",
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


#[cfg(test)]
mod tests {
    use super::*;
    use super::ast::*;
    use std::path::Path;
    use std::fs::{File, read_dir};
    use std::io::{Read, BufReader};

    fn read(s: &str) -> std::string::String {
        let file = File::open(s).unwrap();
        let mut buf_reader = BufReader::new(file);
        let mut contents = std::string::String::new();
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
        assert_eq!(parse_as_module("", Some("foo.js")), Ok(Module {
            statements: vec![],
        }));

        assert_eq!(parse_as_module(" \n \n  \n   ", Some("foo.js")), Ok(Module {
            statements: vec![],
        }));
    }

    #[test]
    fn test_whitespace() {
        assert_eq!(parse_as_module("\n\n\n      \"use strict\"\ntest", Some("foo.js")), Ok(Module {
            statements: vec![
                ModuleStatement::Statement(Statement::Expression(Expression::Literal(Literal::String(String {
                    raw_value: "\"use strict\"",
                    location: Location {
                        start: Position { offset: 9, line: 3, column: 6 },
                        end: Position { offset: 21, line: 3, column: 18 },
                    },
                })))),
                ModuleStatement::Statement(Statement::Expression(Expression::Identifier(Identifier {
                    raw_value: "test",
                    location: Location {
                        start: Position { offset: 22, line: 4, column: 0 },
                        end: Position { offset: 26, line: 4, column: 4 },
                    },
                }))),
            ],
        }));
    }

    #[test]
    fn test_import() {
        assert_eq!(parse_as_module("\n\n   \n     import \"bar\"", Some("foo.js")), Ok(Module {
            statements: vec![
                ModuleStatement::Import {
                    default: None,
                    namespace: None,
                    specifiers: vec![],
                    filename: String {
                        raw_value: "\"bar\"",
                        location: Location {
                            start: Position { offset: 18, line: 3, column: 12 },
                            end: Position { offset: 23, line: 3, column: 17 },
                        },
                    },
                    location: Location {
                        start: Position { offset: 11, line: 3, column: 5 },
                        end: Position { offset: 23, line: 3, column: 17, },
                    },
                },
            ],
        }));

        assert_eq!(parse_as_module("\n\n   \n      import 1 from \"bar\";\n", Some("foo.js")), Err(
            "Expected * or { or identifier or string [foo.js 4:14]\n      import 1 from \"bar\";\n~~~~~~~~~~~~~^".to_string(),
        ));
    }

    #[test]
    fn test_official_pass() {
        each_file("test262-parser-tests/pass", |file, filename| {
            let explicit_filename = format!("test262-parser-tests/pass-explicit/{}", filename.file_name().unwrap().to_str().unwrap());
            let explicit = read(&explicit_filename);

            let normal = parse_as_module(file, Some(filename.to_str().unwrap())).unwrap();
            let explicit = parse_as_module(&explicit, Some(&explicit_filename)).unwrap();

            assert_eq!(normal, explicit);
        });
    }

    #[test]
    fn test_official_fail() {
        each_file("test262-parser-tests/fail", |file, filename| {
            assert!(parse_as_module(file, Some(filename.to_str().unwrap())).is_err());
        });
    }

    #[test]
    fn test_official_early() {
        each_file("test262-parser-tests/early", |file, filename| {
            assert!(parse_as_module(file, Some(filename.to_str().unwrap())).is_err());
        });
    }
}
