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
            ParseResult::Value(_) => seq!($($rest)*),
            ParseResult::Error(e) => ParseResult::Error(e),
            ParseResult::Failed => ParseResult::Failed,
        }
    };
}

macro_rules! with_str {
    ($this:expr, $e:expr) => {{
        let start = $this.stream.offset();

        let e: ParseResult<()> = $e;

        seq! {
            e;
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
    filename: &'b str,
    stream: TextStream<'a>,
}

impl<'a, 'b> Parser<'a, 'b> {
    pub fn new(input: &'a str, filename: &'b str) -> Self {
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

        format!("{} [{} {}:{}]\n{}{}\n{}^",
            message,
            self.filename,
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

    fn next_while<F>(&mut self, mut f: F) -> ParseResult<()> where F: FnMut(char) -> bool {
        loop {
            return match self.next_if(|x| f(x)) {
                Value(_) => continue,
                Error(e) => Error(e),
                Failed => Failed,
            };
        }
    }

    fn match_str(&mut self, pat: &str) -> ParseResult<&'a str> {
        let mut chars = pat.chars();

        with_str!(self, {
            loop {
                break if let Some(pat) = chars.next() {
                    seq! {
                        self.next_if(|c| c == pat);
                        continue
                    }

                } else {
                    Value(())
                }
            }
        })
    }


    fn parse_newline(&mut self) -> ParseResult<()> {
        seq! {
            self.next_if(|c| c == '\n');
            Value(())
        }
    }

    fn parse_whitespace(&mut self) -> ParseResult<()> {
        seq! {
            self.next_if(|c| one_of(c, WHITESPACE));
            Value(())
        }
    }

    fn parse_line_comment(&mut self) -> ParseResult<()> {
        seq! {
            self.match_str("//");
            self.next_while(|c| c != '\n');
            Value(())
        }
    }

    fn parse_block_comment(&mut self) -> ParseResult<()> {
        let start = self.stream.position();

        seq! {
            self.match_str("/*");

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
        loop {
            let matches = alt!(self =>
                self.parse_newline(),
                self.parse_whitespace(),
                self.parse_line_comment(),
                self.parse_block_comment(),
            );

            return match matches {
                Value(_) => continue,
                Failed => Value(()),
                v => v,
            };
        }
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
            self.next_if(|c| c == delimiter);

            let raw_value = with_str!(self, {
                loop {
                    let backup = self.set_backtrack();

                    break match self.stream.next() {
                        // TODO better handling for escapes
                        Some('\\') => {
                            self.stream.next();
                            continue;
                        },
                        Some(c) => {
                            if c == delimiter {
                                // TODO figure out a way to avoid restoring the backup
                                self.restore_backtrack(backup);
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

            self.next_if(|c| c == delimiter);

            Value(StringLiteral { raw_value })
        }
    }

    fn parse_string(&mut self) -> ParseResult<StringLiteral<'a>> {
        alt!(self =>
            self.parse_string_literal('"'),
            self.parse_string_literal('\''),
        )
    }

    fn parse_from_clause(&mut self) -> ParseResult<Span<StringLiteral<'a>>> {
        seq! {
            self.match_str("from");
            self.consume_whitespace();
            with_span!(self, self.parse_string())
        }
    }

    fn parse_import_declaration(&mut self) -> ParseResult<ModuleStatement<'a>> {
        seq! {
            self.match_str("import");
            self.consume_whitespace();
            let value = alt!(self =>
                seq! {
                    let filename = with_span!(self, self.parse_string());
                    Value(ModuleStatement::Import { specifiers: vec![], filename })
                },

                seq! {
                    let specifiers = self.parse_import_clause();
                    self.consume_whitespace();
                    let filename = self.parse_from_clause();
                    Value(ModuleStatement::Import { specifiers, filename })
                },
            );
            self.consume_semicolon();
            Value(value)
        }
    }

    fn parse_end_of_line<A>(&mut self) -> ParseResult<A> {
        let start = self.stream.position();

        if let None = self.stream.next() {
            Failed

        } else {
            Error(self.format_error(start, "Unexpected input"))
        }
    }

    fn parse_module_item(&mut self) -> ParseResult<ModuleStatement<'a>> {
        println!("{:?}", self.stream.position);

        seq! {
            self.consume_whitespace();

            alt!(self =>
                self.parse_import_declaration(),
                //self.parse_export_declaration(),
                //self.parse_statement_list_item(),
                self.parse_end_of_line(),
            )
        }
    }

    pub fn parse_as_module(&mut self) -> Result<Module<'a>, ParseError> {
        let mut statements = vec![];

        loop {
            // TODO should this backtrack ?
            match with_span!(self, self.parse_module_item()) {
                Value(v) => {
                    statements.push(v);
                },
                Error(e) => {
                    println!("{}", e);
                    return Err(e);
                },
                Failed => {
                    if let Some(_) = self.stream.next() {
                        unreachable!();

                    } else {
                        break;
                    }
                },
            }
        }

        Ok(Module { statements })
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_whitespace() {
        assert_eq!(Parser::new("\n\n\n      \"use strict\"\ntest", "foo.js").parse_as_module(), Ok(Module {
            statements: vec![],
        }));
    }

    #[test]
    fn test_import() {
        /*assert_eq!(Parser::new("\n\n   \n     import \"bar\"", "foo.js").parse_as_module(), Ok(Module {
            statements: vec![],
        }));*/

        assert_eq!(Parser::new("\n\n   \n      import 1 from \"bar\";\n", "foo.js").parse_as_module(), Ok(Module {
            statements: vec![],
        }));
    }
}
