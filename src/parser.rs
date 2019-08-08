use std::cell::Cell;
use nom::branch::alt;
use nom::multi::{many0, many0_count, separated_list};
use nom::combinator::{map, map_opt, all_consuming, opt};
use nom::sequence::{preceded, delimited};
use nom::character::{is_alphabetic, is_alphanumeric};
use nom::character::complete::{char, one_of, none_of};
use nom::bytes::complete::{tag, is_a, is_not, take_until, take_while1};
use nom_locate::LocatedSpan;


mod types;
pub use types::*;

mod stream;
use stream::TextStream;


// TODO upstream this into nom_locate
fn position(s: ISpan) -> IResult<ISpan> {
    nom::bytes::complete::take(0usize)(s)
}


/*#[derive(Debug, PartialEq)]
pub enum ParseError {
    Foo
}

impl std::error::Error for ParseError {}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> Result<(), std::fmt::Error> {
        match self {
            ParseError::Foo => write!(f, "Foo"),
        }
    }
}*/


type ISpan<'a> = LocatedSpan<&'a str>;
type IResult<'a, A> = nom::IResult<ISpan<'a>, A, nom::error::VerboseError<ISpan<'a>>>;

fn with_span<'a, A, F>(f: F) -> impl Fn(ISpan<'a>) -> IResult<'a, Span<A>>
    where F: Fn(ISpan<'a>) -> IResult<'a, A> {
    move |s| {
        let (s, start) = position(s)?;
        let start = Position::from(&start);
        let (s, value) = f(s)?;
        let (s, end) = position(s)?;
        let end = Position::from(&end);
        Ok((s, Span { start, value, end }))
    }
}


// https://www.ecma-international.org/ecma-262/9.0/#sec-white-space
const WHITESPACE: &'static str = "\u{0009}\u{000B}\u{000C}\u{0020}\u{00A0}\u{FEFF}\u{1680}\u{2000}\u{2001}\u{2002}\u{2003}\u{2004}\u{2005}\u{2006}\u{2007}\u{2008}\u{2009}\u{200A}\u{202F}\u{205F}\u{3000}";

// https://www.ecma-international.org/ecma-262/9.0/#sec-line-terminators
const NEWLINE: &'static str = "\u{000A}\u{000D}\u{2028}\u{2029}";

fn consume_whitespace(s: ISpan) -> IResult<()> {
    // TODO is there a better function than many0_count ?
    // TODO can this be improved ?
    let (s, _) = many0_count(alt((
        is_a(WHITESPACE),
        is_a(NEWLINE),
        preceded(tag("//"), is_not(NEWLINE)),
        delimited(tag("/*"), take_until("*/"), tag("*/")),
    )))(s)?;

    Ok((s, ()))
}

fn consume_seperator(c: char) -> impl Fn(ISpan) -> IResult<()> {
    move |s| {
        let (s, _) = consume_whitespace(s)?;
        let (s, _) = char(c)(s)?;
        consume_whitespace(s)
    }
}

fn parse_string(s: ISpan) -> IResult<&str> {
    map(alt((
        delimited(
            char('"'),
            alt((tag("\\\""), is_not("\""))),
            char('"')
        ),
        delimited(
            char('\''),
            alt((tag("\\'"), is_not("'"))),
            char('\'')
        ),
    )), |s: ISpan| s.fragment)(s)
}

/*fn parse_directives(s: ISpan) -> IResult<Vec<Span<Directive>>> {
    many0(|s| {
        let (s, _) = consume_whitespace(s)?;
        with_span(map(parse_string, |value| Directive { value }))(s)
    })(s)
}

fn parse_module_body(s: ISpan) -> IResult<> {
}

fn parse_import(s: ISpan) -> IResult<Span<ProgramStatement>> {
    let (s, _) = tag("import")(s)?;
    let (s, _) = consume_whitespace(s)?;

    let parse_default = map(parse_identifier, |local| ImportSpecifier::Default { local });

    alt((
        parse_default,
        |s| {

        },
        |s| {
            let (s, _) = char('{')(s)?;
            let (s, specifiers) = separated_list(char(','), parse_identifier);
            let (s, _) = char('}')(s)?;
            Ok((s, ))
        }
    ))

    let (s, specifiers) = many0(|s| {
    })(s)?;



    alt((

    ))(s)?
}
*/
fn try_insert_semicolon(s: ISpan) -> IResult<()> {
    let (s, start) = position(s)?;

    let (s, _) = consume_whitespace(s)?;

    let (s, end) = position(s)?;

    // Newline, so insert semicolon.
    // It checks the position so that way it will work with multi-line comments which contain newlines.
    if end.line > start.line {
        Ok((s, ()))

    } else {
        let (s, _) = char(';')(s)?;
        Ok((s, ()))
    }
}

// TODO escape sequences
fn parse_string_literal(s: ISpan) -> IResult<StringLiteral> {
    map(alt((
        delimited(
            char('"'),
            alt((tag("\\\""), is_not("\""))),
            char('"')
        ),
        delimited(
            char('\''),
            alt((tag("\\'"), is_not("'"))),
            char('\'')
        ),
    )), |s: ISpan| {
        StringLiteral { raw_value: s.fragment }
    })(s)
}

// TODO handle Unicode properly
// TODO better implementation of this
fn parse_identifier_name(s: ISpan) -> IResult<Span<Identifier>> {
    with_span(|s| {
        let (s, name) = take_while1({
            let first = Cell::new(true);

            move |c: char| {
                if first.get() {
                    first.set(false);
                    c == '$' || c == '_' || c.is_ascii_alphabetic()

                } else {
                    c == '$' || c == '_' || c.is_ascii_alphanumeric()
                }
            }
        })(s)?;

        Ok((s, Identifier { name: name.fragment }))
    })(s)
}

fn parse_binding_identifier(s: ISpan) -> IResult<Span<Identifier>> {
    map_opt(parse_identifier_name, |s| {
        if s.is_reserved_word() {
            None

        } else {
            Some(s)
        }
    })(s)
}

fn parse_imported_default_binding(s: ISpan) -> IResult<Vec<Span<ImportSpecifier>>> {
    let (s, output) = with_span(map(parse_binding_identifier, |local| ImportSpecifier::Default { local }))(s)?;
    Ok((s, vec![output]))
}

fn parse_namespace_import(s: ISpan) -> IResult<Vec<Span<ImportSpecifier>>> {
    let (s, output) = with_span(|s| {
        let (s, _) = char('*')(s)?;
        let (s, _) = consume_whitespace(s)?;
        let (s, _) = tag("as")(s)?;
        let (s, _) = consume_whitespace(s)?;
        let (s, local) = parse_binding_identifier(s)?;
        Ok((s, ImportSpecifier::Namespace { local }))
    })(s)?;
    Ok((s, vec![output]))
}

fn parse_import_specifier(s: ISpan) -> IResult<Span<ImportSpecifier>> {
    with_span(alt((
        |s| {
            let (s, external) = parse_identifier_name(s)?;
            let (s, _) = consume_whitespace(s)?;
            let (s, _) = tag("as")(s)?;
            let (s, _) = consume_whitespace(s)?;
            let (s, local) = parse_binding_identifier(s)?;
            Ok((s, ImportSpecifier::Single { external, local }))
        },

        map(parse_binding_identifier, |local| {
            ImportSpecifier::Single {
                external: local.clone(),
                local,
            }
        }),
    )))(s)
}

fn parse_named_imports(s: ISpan) -> IResult<Vec<Span<ImportSpecifier>>> {
    let (s, _) = char('{')(s)?;
    let (s, _) = consume_whitespace(s)?;

    let (s, singles) = separated_list(consume_seperator(','), parse_import_specifier)(s)?;

    let (s, _) = consume_seperator(',')(s)?;

    let (s, _) = consume_whitespace(s)?;
    let (s, _) = char('}')(s)?;

    Ok((s, singles))
}

fn parse_import_clause(s: ISpan) -> IResult<Vec<Span<ImportSpecifier>>> {
    alt((
        parse_namespace_import,
        parse_named_imports,

        |s| {
            let (s, mut output) = parse_imported_default_binding(s)?;

            let (s, rest) = opt(|s| {
                let (s, _) = consume_whitespace(s)?;
                let (s, _) = char(',')(s)?;
                let (s, _) = consume_whitespace(s)?;

                alt((
                    parse_namespace_import,
                    parse_named_imports,
                ))(s)
            })(s)?;

            if let Some(mut rest) = rest {
                output.append(&mut rest);
            }

            Ok((s, output))
        },
    ))(s)
}

fn parse_from_clause(s: ISpan) -> IResult<Span<StringLiteral>> {
    let (s, _) = tag("from")(s)?;
    let (s, _) = consume_whitespace(s)?;
    with_span(parse_string_literal)(s)
}

fn parse_import_declaration(s: ISpan) -> IResult<ModuleStatement> {
    let (s, _) = tag("import")(s)?;

    let (s, _) = consume_whitespace(s)?;

    let (s, out) = nom::error::context("HELLO", alt((
        map(with_span(parse_string_literal), |filename| ModuleStatement::Import { specifiers: vec![], filename }),

        |s| {
            let (s, specifiers) = parse_import_clause(s)?;
            let (s, _) = consume_whitespace(s)?;
            let (s, filename) = parse_from_clause(s)?;
            Ok((s, ModuleStatement::Import { specifiers, filename } ))
        },
    )))(s)?;

    let (s, _) = try_insert_semicolon(s)?;

    Ok((s, out))
}

/*fn parse_export_declaration(s: ISpan) -> IResult<ModuleStatement> {
}

fn parse_statement_list_item(can_yield: bool, can_await: bool, can_return: bool) -> impl Fn(ISpan) -> IResult<Statement> {
    move |s| {

    }
}*/

fn parse_module_item(s: ISpan) -> IResult<ModuleStatement> {
    let (s, _) = consume_whitespace(s)?;

    parse_import_declaration(s)

    /*alt((
        parse_import_declaration,
        parse_export_declaration,
        map(parse_statement_list_item(false, false, false), |s| ModuleStatement::Statement(s)),
    ))(s)*/
}

fn parse_module_body(s: ISpan) -> IResult<ModuleBody> {
    map(many0(with_span(parse_module_item)), |statements| ModuleBody { statements })(s)
}


pub struct Parser<'a, 'b> {
    stream: TextStream<'a>,
    filename: &'b str,
}

impl<'a, 'b> Parser<'a, 'b> {
    pub fn new(input: &'a str, filename: &'b str) -> Self {
        Self {
            stream: TextStream::new(input),
            filename,
        }
    }

    pub fn parse_as_module(&self) -> Result<Module<'a>, String> {

    }
}



pub fn parse_as_module<'a, 'b>(input: &'a str, filename: &'b str) -> Result<ModuleBody<'a>, String> {
    match all_consuming(parse_module_body)(ISpan::new(input)) {
        Ok((_, ast)) => Ok(ast),
        // TODO really hacky
        Err(err) => match err {
            nom::Err::Error(err) | nom::Err::Failure(err) => {
                println!("{:?}", err.errors);

                println!("{}", nom::error::convert_error(input, nom::error::VerboseError {
                    errors: err.errors.into_iter().map(|(s, k)| (s.fragment, k)).collect(),
                }));
                /*let (span, kind) = err;
                let column = span.get_utf8_column();

                let (left, right) = input.split_at(span.offset);

                let mut left = left.lines();
                let mut right = right.lines();

                let out3 = left.next_back();
                let out2 = left.next_back();
                let out1 = left.next_back();
                let out4 = right.next();
                let out5 = right.next();

                fn push(s: &mut String, i: Option<&str>) {
                    if let Some(i) = i {
                        s.push_str(i);
                        s.push_str("\n");
                    }
                }

                println!("{:?} {:?} {:?} {:?} {:?}", span, out1, out2, out3, out4);

                let mut output = String::new();
                push(&mut output, out1);
                push(&mut output, out2);
                push(&mut output, out3);
                push(&mut output, out4);
                push(&mut output, out5);

                println!("{} [{} {}:{}]\n{}\n{}^", kind.description(), filename, span.line, column, output, "~".repeat(column.saturating_sub(2)));*/
                panic!();
                //Err(convert_error(input, err))
            },
            nom::Err::Incomplete(_) => unreachable!(),
        },
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_whitespace() {
        assert_eq!(parse_as_module("\n\n\n      \"use strict\"\ntest", "foo.js"), Ok(ModuleBody {
            statements: vec![],
        }));
    }

    #[test]
    fn test_import() {
        assert_eq!(parse_as_module("\n\n   \n     import 1 from \"bar\";\n", "foo.js"), Ok(ModuleBody {
            statements: vec![],
        }));
    }
}
