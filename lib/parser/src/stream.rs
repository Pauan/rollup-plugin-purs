use super::combinators::{Position, Parser};


pub type ParseError = String;


#[derive(Debug, Clone)]
pub struct TextStreamState<'a> {
    stream: std::str::Chars<'a>,
    column: u32,
    line: u32,
}


#[derive(Debug)]
pub struct TextStream<'a, 'b> {
    input: &'a str,
    filename: Option<&'b str>,
    state: TextStreamState<'a>,
}

impl<'a, 'b> TextStream<'a, 'b> {
    #[inline]
    pub fn new(input: &'a str, filename: Option<&'b str>) -> Self {
        Self {
            input,
            filename,
            state: TextStreamState {
                stream: input.chars(),
                column: 0,
                line: 0,
            },
        }
    }

    #[inline]
    pub fn slice(&self, start: usize, end: usize) -> &'a str {
        &self.input[start..end]
    }
}


impl<'a, 'b> Parser for TextStream<'a, 'b> {
    type Backtrack = TextStreamState<'a>;
    type Error = ParseError;

    #[inline]
    fn create_backtrack(&self) -> TextStreamState<'a> {
        self.state.clone()
    }

    #[inline]
    fn restore_backtrack(&mut self, backtrack: TextStreamState<'a>) {
        self.state = backtrack;
    }

    fn next(&mut self) -> Option<char> {
        // https://www.ecma-international.org/ecma-262/10.0/#sec-line-terminators
        match self.state.stream.next()? {
            '\u{000A}' |
            '\u{2028}' |
            '\u{2029}' => {
                self.state.column = 0;
                self.state.line += 1;
                Some('\n')
            },
            '\u{000D}' => {
                let clone = self.state.stream.clone();

                match self.state.stream.next() {
                    // \r\n
                    Some('\u{000A}') => {},
                    None => {
                        self.state.stream = clone;
                    },
                }

                self.state.column = 0;
                self.state.line += 1;
                Some('\n')
            },
            c => {
                self.state.column += 1;
                Some(c)
            },
        }
    }

    fn position(&self) -> Position {
        Position {
            // TODO is this faster than just storing the offset directly ?
            offset: self.input.len() - self.state.stream.as_str().len(),
            column: self.state.column,
            line: self.state.line,
        }
    }

    // TODO improve this somehow
    fn error(&self, start: Position, message: &str) -> String {
        let (left, right) = self.input.split_at(start.offset);

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
            start.line + 1,
            start.column + 1,
            &left[left_index..],
            &right[..right_index],
            "~".repeat(start.column as usize),
        )
    }
}
