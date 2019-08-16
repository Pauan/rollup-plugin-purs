#[macro_use]
mod combinators;
pub use combinators::*;

mod stream;
pub use stream::*;

pub mod ast;
use ast::{Location, Position};

mod token;
use token::*;

pub use token::ParseError;


fn consume_whitespace(p: &mut TextStream) -> ParseResult<(), ParseError> {
    unimplemented!();
}


// Good:  {}
// Good:  {foo}
// Good:  {foo,}
// Good:  {foo,bar}
// Good:  {foo,bar,}
//  Bad:  {,}
//  Bad:  {foo bar}
//  Bad:  {foo,,}
pub fn separated_list<'a, A, F>(left: char, right: char, message: &'a str, mut f: F) -> impl FnMut(&mut TextStream) -> ParseResult<Vec<A>, ParseError> + 'a
    where F: FnMut(&mut TextStream) -> ParseResult<A, ParseError> + 'a {
    move |p| {
        let start = p.position();

        char(left)(p)?;

        let mut seen = false;

        many0(|p| {
            consume_whitespace(p)?;

            // TODO new alt combinator for this ?
            alt!(
                |p| {
                    char(right)(p)?;
                    Ok(None)
                },
                |p| {
                    if seen {
                        on_fail(
                            |p| {
                                char(',')(p)?;
                                consume_whitespace(p)
                            },
                            |p| p.error(start, "Expected ,"),
                        )(p)?;
                    }

                    on_fail(
                        alt!(
                            |p| {
                                if seen {
                                    char(right)(p)?;
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
                    )(p)
                },
            )(p)
        })(p)
    }
}



pub struct Parser<'a, 'b> {
    input: &'a str,
    filename: Option<&'b str>,
    stream: TokenStream<'a, 'b>,
    //peeked: Option<Option<Result<Token<'a>, ParseError>>>,
    is_expression: bool,
    is_template: bool,
}

impl<'a, 'b> Parser<'a, 'b> {
    pub fn new(input: &'a str, filename: Option<&'b str>) -> Self {
        Self {
            input,
            filename,
            stream: TokenStream::new(input, filename),
            //peeked: None,
            is_expression: true,
            is_template: false,
        }
    }

    fn error<A>(&self, start: Position, message: &str) -> Result<A, ParseError> {
        Err(format_error(self.input, self.filename, start, message))
    }

    fn next(&mut self, is_expression: bool, is_template: bool) -> Result<Option<Token<'a>>, ParseError> {
        self.stream.next(is_expression, is_template)

        /*match self.peeked.take() {
            Some(v) => v,
            None => self.stream.next(is_expression, is_template),
        }*/
    }

    /*fn peek(&mut self, is_expression: bool, is_template: bool) -> &Result<Option<Token<'a>>, ParseError> {
        let stream = &mut self.stream;
        self.peeked.get_or_insert_with(|| stream.next(is_expression, is_template)).as_ref()
    }*/


    fn statement_list_item(&mut self, ident: ast::Identifier<'a>, can_yield: bool, can_await: bool, can_return: bool) -> Result<ast::Statement<'a>, ParseError> {
        unimplemented!();
    }

    fn expression(&mut self) -> Result<ast::Expression<'a>, ParseError> {
        unimplemented!();
    }


    fn template(&mut self, tag: Option<Box<ast::Expression<'a>>>, kind: TemplateKind, raw: ast::TemplateRaw<'a>) -> Result<ast::Template<'a>, ParseError> {
        let start = raw.location.start;
        let mut end = raw.location.end;

        let mut parts = vec![ast::TemplatePart::TemplateRaw(raw)];

        match kind {
            TemplateKind::Whole => {},
            TemplateKind::Start => {
                'top: loop {
                    parts.push(ast::TemplatePart::Expression(self.expression()?));

                    loop {
                        match self.next(false, true)? {
                            None => self.error(start, "Missing ending `")?,

                            Some(Token::Newline) => {
                                continue;
                            },

                            Some(Token::Template { kind, raw }) => {
                                parts.push(ast::TemplatePart::TemplateRaw(raw));

                                match kind {
                                    TemplateKind::Middle => {
                                        break;
                                    },
                                    TemplateKind::End => {
                                        end = raw.location.end;
                                        break 'top;
                                    },
                                    _ => unreachable!(),
                                }
                            },

                            _ => unreachable!(),
                        }
                    }
                }
            },
            _ => unreachable!(),
        }

        Ok(ast::Template {
            tag,
            parts,
            location: Location { start, end },
        })
    }


    pub fn parse_as_module(&mut self) -> Result<ast::Module<'a>, ParseError> {
        let mut statements = vec![];

        loop {
            match self.next(true, false)? {
                None => {
                    return Ok(ast::Module { statements });
                },
                Some(Token::Newline) => {
                    continue;
                },
                Some(Token::Literal(lit)) => {
                    statements.push(ast::ModuleStatement::Statement(
                        ast::Statement::Expression(
                            ast::Expression::Literal(lit)
                        )
                    ));
                },
                Some(Token::Template { kind, raw }) => {
                    statements.push(ast::ModuleStatement::Statement(
                        ast::Statement::Expression(
                            ast::Expression::Literal(
                                ast::Literal::Template(self.template(None, kind, raw)?)
                            )
                        )
                    ));
                },
                Some(Token::Punctuation { value, location }) => {
                },
                Some(Token::Identifier(ident)) => {
                    statements.push(match ident.raw_value {
                        "import" => {
                            match self.next(true, false)? {
                                Some(Token::Punctuation { value: "*", .. }) => {

                                },
                                Some(Token::Punctuation { value: "{", .. }) => {

                                },
                                Some(Token::Identifier(ident)) => {
                                    let mut specifiers = vec![];

                                    match self.next(false, false)? {
                                        Some(Token::Punctuation { value: ",", .. }) => {
                                            match self.next(true, false)? {
                                                Some(Token::Punctuation { value: "*", .. }) => {
                                                },
                                                Some(Token::Punctuation { value: "{", .. }) => {
                                                },
                                                Some(token)
                                                _ => {
                                                    self.error()
                                                },
                                            }
                                        },
                                        Some(Token::Punctuation { value: ";", .. }) |
                                        Some(Token::Newline) |
                                        None => {},
                                        Some(token) => {
                                            self.error(token.location.start, "Unexpected token")?
                                        },
                                    }

                                    ast::ModuleStatement::Import {
                                        specifiers,
                                        filename: string,
                                    }
                                },
                                Some(Token::Literal(ast::Literal::String(string))) => {
                                    ast::ModuleStatement::Import {
                                        specifiers: vec![],
                                        filename: string,
                                    }
                                },
                                _ => {
                                    self.error(ident.location.end, "Expected * or { or identifier or string")?
                                },
                            }
                        },
                        "export" => {

                        },
                        _ => ast::ModuleStatement::Statement(self.statement_list_item(ident, false, false, false)?),
                    });
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
