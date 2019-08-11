pub type ParseError = String;


pub enum ParseResult<A> {
    Failed,
    Value(A),
    Error(ParseError),
}

pub use ParseResult::*;


#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Position {
    pub offset: usize,
    pub line: usize,
    pub column: usize,
}

impl Position {
    #[inline]
    pub fn increment_column(&mut self) {
        self.column += 1;
    }

    #[inline]
    pub fn increment_line(&mut self) {
        self.column = 0;
        self.line += 1;
    }
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

    pub fn next(&mut self) -> Option<char> {
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

    pub fn next_if<F>(&mut self, f: F) -> ParseResult<char> where F: FnOnce(char) -> bool {
        match self.next() {
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

    pub fn consume_if<F>(&mut self, f: F) -> ParseResult<()> where F: FnOnce(char) -> bool {
        seq! {
            let _ = self.next_if(f);
            Value(())
        }
    }

    #[inline]
    pub fn consume_char(&mut self, pat: char) -> ParseResult<()> {
        self.consume_if(|c| c == pat)
    }

    pub fn consume_while<F>(&mut self, mut f: F) -> ParseResult<()> where F: FnMut(char) -> bool {
        loop {
            return match self.next_if(|x| f(x)) {
                Failed => Failed,
                Value(_) => continue,
                Error(e) => Error(e),
            };
        }
    }

    // TODO make this faster
    pub fn consume_str(&mut self, pat: &str) -> ParseResult<()> {
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
}

impl Iterator for TokenStream<'a> {
}
