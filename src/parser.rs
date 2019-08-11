mod ast;
pub use ast::*;

#[macro_use]
mod combinators;
use combinators::*;

mod stream;
use stream::*;


// https://www.ecma-international.org/ecma-262/10.0/#sec-white-space
const WHITESPACE: &'static str = "\u{0009}\u{000B}\u{000C}\u{0020}\u{00A0}\u{FEFF}\u{1680}\u{2000}\u{2001}\u{2002}\u{2003}\u{2004}\u{2005}\u{2006}\u{2007}\u{2008}\u{2009}\u{200A}\u{202F}\u{205F}\u{3000}";


pub struct Parser<'a, 'b> {
    input: &'a str,
    filename: Option<&'b str>,
    stream: TextStream<'a>,
}

impl<'a, 'b> Parser<'a, 'b> {
    pub fn new(input: &'a str, filename: Option<&'b str>) -> Self {
        Self {
            stream: TextStream::new(input),
            input,
            filename,
        }
    }

    fn start_backtrack(&self) -> TextStream<'a> {
        self.stream.clone()
    }

    fn restore_backtrack(&mut self, stream: TextStream<'a>) {
        self.stream = stream;
    }

    // TODO improve this somehow
    fn format_error(&self, position: Position, message: &str) -> String {
        let (left, right) = self.input.split_at(position.offset);

        let mut left_chars = left.chars();
        let mut right_chars = right.chars();

        let mut left_index = left.len();
        let mut right_index = 0;

        while let Some(c) = left_chars.next_back() {
            if c == '\n' || c == '\r' {
                break;

            } else {
                left_index -= 1;
            }
        }

        while let Some(c) = right_chars.next() {
            if c == '\n' || c == '\r' {
                break;

            } else {
                right_index += 1;
            }
        }

        format!("{} [{}{}:{}]\n{}{}\n{}^",
            message,
            self.filename.map(|x| format!("{} ", x)).unwrap_or_else(|| "".to_string()),
            position.line + 1,
            position.column + 1,
            &left[left_index..],
            &right[..right_index],
            "~".repeat(position.column),
        )
    }


    fn parse_eof(&mut self) -> ParseResult<()> {
        if let None = self.stream.next() {
            Value(())

        } else {
            Failed
        }
    }

    fn parse_newline(&mut self) -> ParseResult<()> {
        self.stream.consume_char('\n')
    }

    fn parse_whitespace(&mut self) -> ParseResult<()> {
        self.stream.consume_if(|c| one_of(c, WHITESPACE))
    }

    fn parse_line_comment(&mut self) -> ParseResult<()> {
        seq! {
            self.stream.consume_str("//");

            each0(|| cond!(self =>
                alt!(self =>
                    self.parse_newline(),
                    self.parse_eof(),
                ),
                Value(None),
                Value(Some(())),
            ))
        }
    }

    fn parse_block_comment(&mut self) -> ParseResult<()> {
        let start = self.stream.position();

        seq! {
            self.stream.consume_str("/*");

            loop {
                break match self.stream.next() {
                    Some('*') => match self.stream.next() {
                        Some('/') => Value(()),
                        Some(_) => continue,
                        None => Error(self.format_error(start, "Missing ending */")),
                    },
                    Some(_) => continue,
                    None => Error(self.format_error(start, "Missing ending */")),
                };
            }
        }
    }

    fn consume_whitespace_(&mut self) -> ParseResult<Option<()>> {
        alt_opt!(self =>
            // If there are multiple whitespace characters it will consume
            // all of them before checking the rest of the alt branches
            each1(|| alt_opt!(self =>
                self.parse_newline(),
                self.parse_whitespace(),
            )),
            self.parse_line_comment(),
            self.parse_block_comment(),
        )
    }

    fn consume_whitespace0(&mut self) -> ParseResult<()> {
        each0(|| self.consume_whitespace_())
    }

    fn consume_whitespace1(&mut self) -> ParseResult<()> {
        each1(|| self.consume_whitespace_())
    }

    fn consume_semicolon(&mut self) -> ParseResult<()> {
        let start = self.stream.position();

        seq! {
            self.consume_whitespace0();
            {
                let end = self.stream.position();

                // Newline, so insert semicolon.
                // It checks the position so that way it will work with multi-line comments which contain newlines.
                if end.line > start.line {
                    Value(())

                } else {
                    match self.stream.next() {
                        Some(';') | None => {
                            Value(())
                        },
                        _ => {
                            Error(self.format_error(start, "Missing ;"))
                        },
                    }
                }
            }
        }
    }

    fn parse_name_space_imports(&mut self) -> ParseResult<Vec<Span<ImportSpecifier<'a>>>> {
        seq! {
            self.consume_whitespace0();
            let value = with_span!(self, seq! {
                self.stream.consume_char('*');
                self.consume_whitespace0();
                self.stream.consume_str("as");
                self.consume_whitespace1();
                let local = with_span!(self, self.parse_identifier());
                Value(ImportSpecifier::Namespace { local })
            });
            Value(vec![value])
        }
    }

    fn parse_import_specifier(&mut self) -> ParseResult<ImportSpecifier<'a>> {
        alt!(self =>
            seq! {
                self.consume_whitespace0();
                let external = with_span!(self, self.parse_identifier_name());
                self.consume_whitespace1();
                self.stream.consume_str("as");
                self.consume_whitespace1();
                let local = with_span!(self, self.parse_identifier());
                Value(ImportSpecifier::Single { external, local })
            },
            seq! {
                let local = with_span!(self, self.parse_identifier());
                Value(ImportSpecifier::Single {
                    external: local.clone(),
                    local,
                })
            },
        )
    }

    fn parse_named_imports(&mut self) -> ParseResult<Vec<Span<ImportSpecifier<'a>>>> {
        separated_list!(self, '{', '}', "identifier", with_span!(self, self.parse_import_specifier()))
    }

    fn parse_import_clause(&mut self) -> ParseResult<Vec<Span<ImportSpecifier<'a>>>> {
        alt!(self =>
            self.parse_name_space_imports(),
            self.parse_named_imports(),

            seq! {
                self.consume_whitespace1();

                let local = with_span!(self, seq! {
                    let local = with_span!(self, self.parse_identifier());
                    Value(ImportSpecifier::Default { local })
                });

                let rest = alt_opt!(self =>
                    seq! {
                        self.consume_whitespace0();
                        self.stream.consume_char(',');

                        alt!(self =>
                            self.parse_name_space_imports(),
                            self.parse_named_imports(),
                        )
                    },
                );

                if let Some(mut rest) = rest {
                    rest.insert(0, local);
                    Value(rest)

                } else {
                    Value(vec![local])
                }
            },
        )
    }

    fn parse_string_literal(&mut self, delimiter: char) -> ParseResult<StringLiteral<'a>> {
        let start = self.stream.position();

        seq! {
            let raw_value = with_str!(self, seq! {
                self.stream.consume_char(delimiter);

                loop {
                    break match self.stream.next() {
                        // TODO better handling for escapes
                        Some('\\') => {
                            self.stream.next();
                            continue;
                        },
                        Some(c) => {
                            if c == delimiter {
                                Value(())

                            } else {
                                continue;
                            }
                        },
                        None => {
                            Error(self.format_error(start, &format!("Missing ending {}", delimiter)))
                        },
                    }
                }
            });

            Value(StringLiteral { raw_value })
        }
    }

    fn parse_string(&mut self) -> ParseResult<StringLiteral<'a>> {
        alt!(self =>
            self.parse_string_literal('"'),
            self.parse_string_literal('\''),
        )
    }

    fn parse_from_clause(&mut self) -> ParseResult<StringLiteral<'a>> {
        seq! {
            self.stream.consume_str("from");
            self.consume_whitespace0();
            self.parse_string()
        }
    }

    fn parse_import_declaration(&mut self) -> ParseResult<ModuleStatement<'a>> {
        seq! {
            self.stream.consume_str("import");
            let value = {
                let start = self.stream.position();

                alt!(self =>
                    seq! {
                        self.consume_whitespace0();
                        let filename = with_span!(self, self.parse_string());
                        Value(ModuleStatement::Import { specifiers: vec![], filename })
                    },

                    seq! {
                        let specifiers = self.parse_import_clause();
                        let filename = with_span!(self, self.parse_from_clause());
                        Value(ModuleStatement::Import { specifiers, filename })
                    },

                    Error(self.format_error(start, "Missing { or * or identifier")),
                )
            };
            // TODO should this be included in the Span ?
            self.consume_semicolon();
            Value(value)
        }
    }

    fn parse_block_statement(&mut self, has_yield: bool, has_await: bool, has_return: bool) -> ParseResult<Statement<'a>> {
        seq! {
            self.stream.consume_char('{');

            let statements = many0(|| seq! {
                self.consume_whitespace();

                // TODO new alt combinator for this ?
                alt!(self =>
                    seq! {
                        self.stream.consume_char('}');
                        Value(None)
                    },
                    seq! {
                        let value = with_span!(self, self.parse_statement_list_item(has_yield, has_await, has_return));
                        Value(Some(value))
                    },
                )
            });

            Value(Statement::Block { statements })
        }
    }

    // TODO handle Unicode
    fn parse_identifier_name(&mut self) -> ParseResult<Identifier<'a>> {
        seq! {
            let name = with_str!(self, seq! {
                self.stream.consume_if(|c| c == '$' || c == '_' || c.is_ascii_alphabetic());

                each0(|| alt_opt!(self =>
                    self.stream.consume_if(|c| c == '$' || c == '_' || c.is_ascii_alphanumeric()),
                ))
            });

            Value(Identifier { name })
        }
    }

    fn parse_identifier(&mut self) -> ParseResult<Identifier<'a>> {
        let start = self.stream.position();

        seq! {
            let v = self.parse_identifier_name();

            if v.is_reserved_word() {
                Error(self.format_error(start, "Reserved word"))

            } else {
                Value(v)
            }
        }
    }

    fn parse_expression(&mut self, has_in: bool, has_yield: bool, has_await: bool) -> ParseResult<Expression<'a>> {
        alt!(self =>
            seq! {
                let v = self.parse_string();
                Value(Expression::Literal(Literal::String(v)))
            },
            seq! {
                let v = self.parse_identifier();
                Value(Expression::Identifier(v))
            },
        )
    }

    fn parse_statement(&mut self, has_yield: bool, has_await: bool, has_return: bool) -> ParseResult<Statement<'a>> {
        seq! {
            let value = alt!(self =>
                self.parse_block_statement(has_yield, has_await, has_return),
                // This must go at the end
                seq! {
                    let expression = with_span!(self, self.parse_expression(true, has_yield, has_await));
                    self.consume_semicolon();
                    Value(Statement::Expression(expression))
                },
            );
            Value(value)
        }
    }

    fn parse_declaration(&mut self, has_yield: bool, has_await: bool) -> ParseResult<Statement<'a>> {
        Failed
    }

    fn parse_statement_list_item(&mut self, has_yield: bool, has_await: bool, has_return: bool) -> ParseResult<Statement<'a>> {
        alt!(self =>
            self.parse_statement(has_yield, has_await, has_return),
            self.parse_declaration(has_yield, has_await),
        )
    }

    fn parse_module_item(&mut self) -> ParseResult<Option<Span<ModuleStatement<'a>>>> {
        seq! {
            self.consume_whitespace();

            alt_opt!(self =>
                with_span!(self, self.parse_import_declaration()),

                /*with_span!(self, self.parse_export_declaration()),*/

                with_span!(self, seq! {
                    let statement = self.parse_statement_list_item(false, false, false);
                    Value(ModuleStatement::Statement(statement))
                }),

                {
                    let start = self.stream.position();
                    alt!(self =>
                        self.parse_eof(),
                        Error(self.format_error(start, "Unexpected input")),
                    )
                },
            )
        }
    }

    pub fn parse_as_module(&mut self) -> Result<Module<'a>, ParseError> {
        // TODO should this backtrack ?
        let statements = many0(|| self.parse_module_item());

        match statements {
            Value(statements) => {
                Ok(Module { statements })
            },
            Error(e) => {
                //println!("{}", e);
                Err(e)
            },
            Failed => {
                unreachable!();
            },
        }
    }
}


#[cfg(test)]
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
