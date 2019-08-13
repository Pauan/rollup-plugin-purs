use super::stream::{ParseResult, Value, Error, Failed};


pub fn one_of(input: char, pat: &str) -> bool {
    for p in pat.chars() {
        if p == input {
            return true;
        }
    }

    false
}

pub fn many0<A, F>(mut f: F) -> ParseResult<Vec<A>> where F: FnMut() -> ParseResult<Option<A>> {
    let mut output = vec![];

    loop {
        return match f() {
            Failed => Failed,
            Value(Some(value)) => {
                output.push(value);
                continue;
            },
            Value(None) => Value(output),
            Error(e) => Error(e),
        }
    }
}

pub fn each0<F>(mut f: F) -> ParseResult<()> where F: FnMut() -> ParseResult<Option<()>> {
    loop {
        return match f() {
            Failed => Failed,
            Value(Some(_)) => continue,
            Value(None) => Value(()),
            Error(e) => Error(e),
        }
    }
}

pub fn each1<F>(mut f: F) -> ParseResult<()> where F: FnMut() -> ParseResult<Option<()>> {
    let mut matched = false;

    loop {
        return match f() {
            Failed => Failed,
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
        }
    }
}

macro_rules! backtrack {
    ($this:expr, $e:expr) => {{
        let old_stream = $this.start_backtrack();

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

macro_rules! test {
    ($this:expr, $test:expr) => {{
        let backup = $this.start_backtrack();
        let result = $test;
        $this.restore_backtrack(backup);
        result
    }}
}

macro_rules! cond {
    ($this:expr => $test:expr, $yes:expr, $no:expr,) => {
        match test!($this, $test) {
            ParseResult::Failed => $no,
            ParseResult::Value(()) => $yes,
            // TODO is this correct ?
            ParseResult::Error(e) => ParseResult::Error(e),
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

// Good:  {}
// Good:  {foo}
// Good:  {foo,}
// Good:  {foo,bar}
// Good:  {foo,bar,}
//  Bad:  {,}
//  Bad:  {foo bar}
//  Bad:  {foo,,}
macro_rules! separated_list {
    ($this:expr, $left:expr, $right:expr, $message:expr, $e:expr) => {{
        let start = $this.stream.position();
        let mut seen = false;

        seq! {
            $this.stream.consume_char($left);

            many0(|| seq! {
                $this.consume_whitespace();

                // TODO new alt combinator for this ?
                alt!($this =>
                    seq! {
                        $this.stream.consume_char($right);
                        Value(None)
                    },
                    seq! {
                        if seen {
                            alt!($this =>
                                seq! {
                                    $this.stream.consume_char(',');
                                    $this.consume_whitespace()
                                },
                                Error($this.format_error(start, "Missing ,")),
                            )

                        } else {
                            Value(())
                        };

                        alt!($this =>
                            if seen {
                                seq! {
                                    $this.stream.consume_char($right);
                                    Value(None)
                                }

                            } else {
                                Failed
                            },

                            seq! {
                                let value = $e;

                                {
                                    seen = true;
                                    Value(Some(value))
                                }
                            },

                            Error($this.format_error(start, &format!("Missing {} or {}", $message, $right))),
                        )
                    },
                )
            })
        }
    }};
}
