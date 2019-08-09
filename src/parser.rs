mod types;
pub use types::*;


// https://www.ecma-international.org/ecma-262/10.0/#sec-white-space
const WHITESPACE: &'static str = "\u{0009}\u{000B}\u{000C}\u{0020}\u{00A0}\u{FEFF}\u{1680}\u{2000}\u{2001}\u{2002}\u{2003}\u{2004}\u{2005}\u{2006}\u{2007}\u{2008}\u{2009}\u{200A}\u{202F}\u{205F}\u{3000}";


type ParseError = String;


enum ParseResult<A> {
    Value(A),
    Error(ParseError),
    Failed,
}

use ParseResult::{Value, Error, Failed};


fn one_of(input: char, pat: &str) -> bool {
    for p in pat.chars() {
        if p == input {
            return true;
        }
    }

    false
}

fn many0<A, F>(mut f: F) -> ParseResult<Vec<A>> where F: FnMut() -> ParseResult<Option<A>> {
    let mut output = vec![];

    loop {
        return match f() {
            Value(Some(value)) => {
                output.push(value);
                continue;
            },
            Value(None) => Value(output),
            Error(e) => Error(e),
            Failed => Failed,
        }
    }
}

fn each0<F>(mut f: F) -> ParseResult<()> where F: FnMut() -> ParseResult<Option<()>> {
    loop {
        return match f() {
            Value(Some(_)) => continue,
            Value(None) => Value(()),
            Error(e) => Error(e),
            Failed => Failed,
        }
    }
}

fn each1<F>(mut f: F) -> ParseResult<()> where F: FnMut() -> ParseResult<Option<()>> {
    let mut matched = false;

    loop {
        return match f() {
            Value(Some(_)) => {
                matched = true;
                continue;
            },
            Value(None) => {
                if matched {
                    Value(())
                } else {
                    Failed
                }
            },
            Error(e) => Error(e),
            Failed => Failed,
        }
    }
}

macro_rules! backtrack {
    ($this:expr, $e:expr) => {{
        let old_stream = $this.set_backtrack();

        match $e {
            ParseResult::Value(v) => ParseResult::Value(v),
            v => {
                $this.restore_backtrack(old_stream);
                v
            },
        }
    }};
}

macro_rules! alt {
    ($this:expr => $e:expr,) => {
        backtrack!($this, $e)
    };
    ($this:expr => $e:expr, $($rest:expr,)*) => {
        match backtrack!($this, $e) {
            ParseResult::Failed => alt!($this => $($rest,)*),
            v => v,
        }
    };
}

macro_rules! alt_opt {
    ($this:expr => $($e:expr,)+) => {
        alt!($this =>
            $(seq! {
                let value = $e;
                Value(Some(value))
            },)+
            Value(None),
        )
    };
}

macro_rules! seq {
    ($final:expr) => {
        $final
    };
    (let $v:pat = $e:expr; $($rest:tt)*) => {
        match $e {
            ParseResult::Value($v) => seq!($($rest)*),
            ParseResult::Error(e) => ParseResult::Error(e),
            ParseResult::Failed => ParseResult::Failed,
        }
    };
    ($e:expr; $($rest:tt)*) => {
        match $e {
            ParseResult::Value(()) => seq!($($rest)*),
            ParseResult::Error(e) => ParseResult::Error(e),
            ParseResult::Failed => ParseResult::Failed,
        }
    };
}

macro_rules! with_str {
    ($this:expr, $e:expr) => {{
        let start = $this.stream.offset();

        seq! {
            $e;
            ParseResult::Value(&$this.input[start..$this.stream.offset()])
        }
    }};
}

macro_rules! with_span {
    ($this:expr, $e:expr) => {{
        let start = $this.stream.position();

        seq! {
            let value = $e;
            {
                let end = $this.stream.position();
                ParseResult::Value(Span { start, value, end })
            }
        }
    }};
}


#[derive(Debug, Clone)]
pub struct TextStream<'a> {
    stream: std::str::Chars<'a>,
    position: Position,
}

impl<'a> TextStream<'a> {
    pub fn new(input: &'a str) -> Self {
        Self {
            stream: input.chars(),
            position: Position {
                offset: 0,
                line: 0,
                column: 0,
            },
        }
    }

    #[inline]
    pub fn position(&self) -> Position {
        self.position
    }

    #[inline]
    pub fn offset(&self) -> usize {
        self.position.offset
    }
}

impl<'a> Iterator for TextStream<'a> {
    type Item = char;

    fn next(&mut self) -> Option<char> {
        let c = self.stream.next()?;

        self.position.offset += 1;

        // Normalize newlines to '\n'
        // https://www.ecma-international.org/ecma-262/10.0/#sec-line-terminators
        match c {
            '\u{000A}' |
            '\u{2028}' |
            '\u{2029}' => {
                self.position.increment_line();
                Some('\n')
            },
            // \r\n
            '\u{000D}' => {
                let old = self.stream.clone();

                if let Some('\u{000A}') = self.stream.next() {
                    self.position.offset += 1;

                } else {
                    self.stream = old;
                }

                self.position.increment_line();
                Some('\n')
            },
            c => {
                self.position.increment_column();
                Some(c)
            },
        }
    }
}


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

    fn set_backtrack(&self) -> TextStream<'a> {
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

    fn next_if<F>(&mut self, f: F) -> ParseResult<char> where F: FnOnce(char) -> bool {
        match self.stream.next() {
            Some(c) => {
                if f(c) {
                    Value(c)

                } else {
                    Failed
                }
            },
            None => Failed,
        }
    }

    fn consume_while<F>(&mut self, mut f: F) -> ParseResult<()> where F: FnMut(char) -> bool {
        loop {
            return match self.next_if(|x| f(x)) {
                Value(_) => continue,
                Error(e) => Error(e),
                Failed => Failed,
            };
        }
    }

    fn consume_if<F>(&mut self, f: F) -> ParseResult<()> where F: FnOnce(char) -> bool {
        seq! {
            let _ = self.next_if(f);
            Value(())
        }
    }

    fn consume_str(&mut self, pat: &str) -> ParseResult<()> {
        let mut chars = pat.chars();

        loop {
            break if let Some(pat) = chars.next() {
                seq! {
                    self.consume_if(|c| c == pat);
                    continue
                }

            } else {
                Value(())
            };
        }
    }


    fn parse_newline(&mut self) -> ParseResult<()> {
        self.consume_if(|c| c == '\n')
    }

    fn parse_whitespace(&mut self) -> ParseResult<()> {
        self.consume_if(|c| one_of(c, WHITESPACE))
    }

    fn parse_line_comment(&mut self) -> ParseResult<()> {
        seq! {
            self.consume_str("//");
            self.consume_while(|c| c != '\n')
        }
    }

    fn parse_block_comment(&mut self) -> ParseResult<()> {
        let start = self.stream.position();

        seq! {
            self.consume_str("/*");

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

    fn consume_whitespace(&mut self) -> ParseResult<()> {
        each0(|| alt_opt!(self =>
            // If there are multiple whitespace characters it will consume
            // all of them before checking the rest of the alt branches
            each1(|| alt_opt!(self =>
                self.parse_newline(),
                self.parse_whitespace(),
            )),
            self.parse_line_comment(),
            self.parse_block_comment(),
        ))
    }

    fn consume_semicolon(&mut self) -> ParseResult<()> {
        let start = self.stream.position();

        seq! {
            self.consume_whitespace();
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
                            Failed
                        },
                    }
                }
            }
        }
    }

    fn parse_import_clause(&mut self) -> ParseResult<Vec<Span<ImportSpecifier<'a>>>> {
        alt!(self =>
            Failed,
        )
    }

    fn parse_string_literal(&mut self, delimiter: char) -> ParseResult<StringLiteral<'a>> {
        let start = self.stream.position();

        seq! {
            let raw_value = with_str!(self, seq! {
                self.consume_if(|c| c == delimiter);

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
            self.consume_str("from");
            self.consume_whitespace();
            self.parse_string()
        }
    }

    fn parse_import_declaration(&mut self) -> ParseResult<ModuleStatement<'a>> {
        seq! {
            self.consume_str("import");
            self.consume_whitespace();
            let value = alt!(self =>
                seq! {
                    let filename = with_span!(self, self.parse_string());
                    Value(ModuleStatement::Import { specifiers: vec![], filename })
                },

                seq! {
                    let specifiers = self.parse_import_clause();
                    self.consume_whitespace();
                    let filename = with_span!(self, self.parse_from_clause());
                    Value(ModuleStatement::Import { specifiers, filename })
                },
            );
            // TODO should this be included in the Span ?
            self.consume_semicolon();
            Value(value)
        }
    }

    fn parse_block_statement(&mut self, has_yield: bool, has_await: bool, has_return: bool) -> ParseResult<Statement<'a>> {
        seq! {
            self.consume_if(|c| c == '{');

            let statements = many0(|| seq! {
                self.consume_whitespace();

                // TODO new alt combinator for this ?
                alt!(self =>
                    seq! {
                        self.consume_if(|c| c == '}');
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
                self.consume_if(|c| c == '$' || c == '_' || c.is_ascii_alphabetic());

                each0(|| alt_opt!(self =>
                    self.consume_if(|c| c == '$' || c == '_' || c.is_ascii_alphanumeric()),
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

    fn parse_end_of_line<A>(&mut self) -> ParseResult<A> {
        let start = self.stream.position();

        if let None = self.stream.next() {
            Failed

        } else {
            Error(self.format_error(start, "Unexpected input"))
        }
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

                self.parse_end_of_line(),
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
