use super::combinators::*;


pub type ParseError = String;


#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Position {
    pub offset: usize,
    pub line: u32,
    pub column: u32,
}

impl Default for Position {
    fn default() -> Self {
        Position {
            offset: 0,
            line: 0,
            column: 0,
        }
    }
}


#[derive(Debug, Clone)]
pub struct State<'a> {
    stream: std::str::Chars<'a>,
    column: u32,
    line: u32,
}


#[derive(Debug, Clone)]
pub struct TextStream<'a, 'b> {
    input: &'a str,
    filename: Option<&'b str>,
    state: State<'a>,
}

impl<'a, 'b> TextStream<'a, 'b> {
    #[inline]
    pub fn new(input: &'a str, filename: Option<&'b str>) -> Self {
        Self {
            input,
            filename,
            state: State {
                stream: input.chars(),
                column: 0,
                line: 0,
            },
        }
    }

    pub fn position(&self) -> Position {
        Position {
            // TODO is this faster than just storing the offset directly ?
            offset: self.input.len() - self.state.stream.as_str().len(),
            column: self.state.column,
            line: self.state.line,
        }
    }

    #[inline]
    pub fn slice(&self, start: usize, end: usize) -> &'a str {
        &self.input[start..end]
    }

    // TODO improve this somehow
    pub fn error(&self, start: Position, message: &str) -> String {
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

impl<'a, 'b> Parser for TextStream<'a, 'b> {
    type Backtrack = State<'a>;

    #[inline]
    fn create_backtrack(&self) -> Self::Backtrack {
        self.state.clone()
    }

    #[inline]
    fn restore_backtrack(&mut self, backtrack: Self::Backtrack) {
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
}
