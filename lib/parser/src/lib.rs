pub mod ast;

mod token;
use token::*;

pub use token::ParseError;


pub struct Parser<'a, 'b> {
    input: &'a str,
    filename: Option<&'b str>,
    stream: TokenStream<'a, 'b>,
    peeked: Option<Option<Result<Token<'a>, ParseError>>>,
    is_expression: bool,
    is_template: bool,
}

impl<'a, 'b> Parser<'a, 'b> {
    pub fn new(input: &'a str, filename: Option<&'b str>) -> Self {
        Self {
            input,
            filename,
            stream: TokenStream::new(input, filename),
            peeked: None,
            is_expression: true,
            is_template: false,
        }
    }

    fn next(&mut self, is_expression: bool, is_template: bool) -> Option<Result<Token<'a>, ParseError>> {
        match self.peeked.take() {
            Some(v) => v,
            None => self.stream.next(is_expression, is_template),
        }
    }

    fn peek(&mut self, is_expression: bool, is_template: bool) -> Option<&Result<Token<'a>, ParseError>> {
        let stream = &mut self.stream;
        self.peeked.get_or_insert_with(|| stream.next(is_expression, is_template)).as_ref()
    }


    fn statement_list_item(&mut self, ident: ast::Identifier<'a>, can_yield: bool, can_await: bool, can_return: bool) -> Result<ast::Statement<'a>, ParseError> {
        unimplemented!();
    }

    pub fn parse_as_module(&mut self) -> Result<ast::Module<'a>, ParseError> {
        let mut statements = vec![];

        loop {
            match self.next(self.is_expression, self.is_template) {
                Some(value) => {
                    match value? {
                        Token::Newline => {
                            continue;
                        },
                        Token::Literal(lit) => {
                            statements.push(ast::ModuleStatement::Statement(ast::Statement::Expression(ast::Expression::Literal(lit))));
                            continue;
                        },
                        Token::Template { kind, raw } => {
                        },
                        Token::Punctuation { value, location } => {
                        },
                        Token::Identifier(ident) => {
                            /*match ident.raw_value() {
                                "import" => {

                                },
                                "export" => {

                                },
                                ident => self.statement_list_item(ident, false, false, false),
                            }*/
                        },
                    }
                },
                None => {
                    return Ok(ast::Module { statements });
                },
            }
        }
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
