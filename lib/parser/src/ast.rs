use super::token::hex_to_char;
use std::borrow::Cow;
use regex::{Regex, Captures};
use lazy_static::lazy_static;


#[derive(Debug, Clone, PartialEq)]
pub struct Location {
    pub start: Position,
    pub end: Position,
}


#[derive(Debug, Clone, PartialEq)]
pub struct Identifier<'a> {
    pub raw_value: &'a str,
    pub location: Location,
}

impl<'a> Identifier<'a> {
    // https://www.ecma-international.org/ecma-262/10.0/#prod-ReservedWord
    pub fn is_reserved_word(&self) -> bool {
        match self.raw_value {
            // Keywords
            "await" | "break" | "case" | "catch" | "class" | "const" | "continue" | "debugger" | "default" | "delete" | "do" |
            "else" | "export" | "extends" | "finally" | "for" | "function" | "if" | "import" | "in" | "instanceof" | "new" |
            "return" | "super" | "switch" | "this" | "throw" | "try" | "typeof" | "var" | "void" | "while" | "with" | "yield" => true,
            // Static early errors
            "let" | "static" => true,
            // Future reserved words
            "enum" | "implements" | "package" | "protected" | "interface" | "private" | "public" => true,
            // Literals
            "null" | "true" | "false" => true,
            _ => false,
        }
    }

    pub fn normalized_value(&self) -> Cow<'a, str> {
        lazy_static! {
            static ref REGEX: Regex = Regex::new(r"\\u(?:\{([0-9a-fA-F]+)\}|([0-9a-fA-F]{4}))").unwrap();
        }

        REGEX.replace_all(self.raw_value, |cap: &Captures| {
            let cap = cap.get(1).unwrap_or_else(|| cap.get(2).unwrap());
            hex_to_char(cap.as_str()).unwrap().to_string()
        })
    }
}


#[derive(Debug, Clone, PartialEq)]
pub struct String<'a> {
    pub raw_value: &'a str,
    pub location: Location,
}


#[derive(Debug, Clone, PartialEq)]
pub struct Number<'a> {
    pub raw_value: &'a str,
    pub location: Location,
}


#[derive(Debug, Clone, PartialEq)]
pub struct RegExp<'a> {
    pub raw_pattern: &'a str,
    pub raw_flags: &'a str,
    pub location: Location,
}


#[derive(Debug, Clone, PartialEq)]
pub struct TemplateRaw<'a> {
    pub raw_value: &'a str,
    pub location: Location,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TemplatePart<'a> {
    TemplateRaw(TemplateRaw<'a>),
    Expression(Expression<'a>),
}

#[derive(Debug, Clone, PartialEq)]
pub struct Template<'a> {
    pub tag: Option<Box<Expression<'a>>>,
    pub parts: Vec<TemplatePart<'a>>,
    pub location: Location,
}


#[derive(Debug, Clone, PartialEq)]
pub enum Literal<'a> {
    Null {
        location: Location,
    },
    Boolean {
        value: bool,
        location: Location,
    },
    String(String<'a>),
    Number(Number<'a>),
    RegExp(RegExp<'a>),
    Template(Template<'a>),
}


#[derive(Debug, Clone, PartialEq)]
pub struct SwitchCase<'a> {
    pub test: Option<Expression<'a>>,
    pub yes: Vec<Statement<'a>>,
    pub location: Location,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TryCatch<'a> {
    pub param: Option<Pattern<'a>>,
    pub body: Vec<Statement<'a>>,
    pub location: Location,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ForInitialize<'a> {
    VariableDeclaration(VariableDeclaration<'a>),
    Expression(Expression<'a>),
}

#[derive(Debug, Clone, PartialEq)]
pub enum ForInPattern<'a> {
    VariableDeclaration(VariableDeclaration<'a>),
    Pattern(Pattern<'a>),
}

#[derive(Debug, Clone, PartialEq)]
pub enum VariableKind {
    Var,
    Let,
    Const,
}

#[derive(Debug, Clone, PartialEq)]
pub struct VariableAssignment<'a> {
    pub pattern: Pattern<'a>,
    pub initial: Option<Expression<'a>>,
    pub location: Location,
}

#[derive(Debug, Clone, PartialEq)]
pub struct VariableDeclaration<'a> {
    pub kind: VariableKind,
    pub assignments: Vec<VariableAssignment<'a>>,
    pub location: Location,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Restable<'a, A> {
    Normal(A),
    Rest(Box<Pattern<'a>>),
}

#[derive(Debug, Clone, PartialEq)]
pub struct PatternObjectProperty<'a> {
    pub key: ObjectPropertyKey<'a>,
    pub value: Pattern<'a>,
    pub is_shorthand: bool,
    pub location: Location,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Pattern<'a> {
    Identifier(Identifier<'a>),
    Object {
        properties: Vec<Restable<'a, PatternObjectProperty<'a>>>,
        location: Location,
    },
    Array {
        elements: Vec<Option<Pattern<'a>>>,
        location: Location,
    },
    Rest(Restable<'a, Box<Pattern<'a>>>),
    Default {
        left: Box<Pattern<'a>>,
        // TODO get rid of this Box somehow
        right: Box<Expression<'a>>,
        location: Location,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum PropertyKind {
    Init,
    Get,
    Set,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ObjectPropertyKey<'a> {
    Identifier(Identifier<'a>),
    Expression(Expression<'a>),
}

#[derive(Debug, Clone, PartialEq)]
pub struct FunctionMetadata {
    pub is_generator: bool,
    pub is_async: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ObjectProperty<'a> {
    pub kind: PropertyKind,
    pub key: ObjectPropertyKey<'a>,
    pub value: Expression<'a>,
    pub is_method: bool,
    pub is_shorthand: bool,
    pub location: Location,
}

#[derive(Debug, Clone, PartialEq)]
pub enum MethodDefinitionKind {
    Constructor,
    Method,
    Get,
    Set,
}

#[derive(Debug, Clone, PartialEq)]
pub struct MethodDefinition<'a> {
    pub kind: MethodDefinitionKind,
    pub key: ObjectPropertyKey<'a>,
    pub params: Vec<Pattern<'a>>,
    pub body: Vec<Statement<'a>>,
    pub metadata: FunctionMetadata,
    pub is_static: bool,
    pub location: Location,
}

#[derive(Debug, Clone, PartialEq)]
pub enum UnaryKind {
    Minus,
    Plus,
    Not,
    BitNot,
    Typeof,
    Void,
    Delete,
    PrefixIncrement,
    PostfixIncrement,
    PrefixDecrement,
    PostfixDecrement,
}

#[derive(Debug, Clone, PartialEq)]
pub enum BinaryKind {
    DoubleEqual,
    DoubleNotEqual,
    TripleEqual,
    TripleNotEqual,
    Less,
    LessEqual,
    Greater,
    GreaterEqual,
    LeftShift,
    RightShift,
    UnsignedRightShift,
    Plus,
    Minus,
    Multiply,
    Divide,
    Modulo,
    Exponent,
    BitOr,
    BitXor,
    BitAnd,
    In,
    Instanceof,
    Or,
    And,
}

#[derive(Debug, Clone, PartialEq)]
pub enum AssignKind {
    Normal,
    Plus,
    Minus,
    Multiply,
    Divide,
    Modulo,
    Exponent,
    LeftShift,
    RightShift,
    UnsignedRightShift,
    BitOr,
    BitXor,
    BitAnd,
}

#[derive(Debug, Clone, PartialEq)]
pub enum LookupProperty<'a> {
    Identifier(Identifier<'a>),
    Expression(Box<Expression<'a>>),
}

#[derive(Debug, Clone, PartialEq)]
pub enum Spreadable<'a, A> {
    Normal(A),
    Spread {
        argument: Expression<'a>,
        location: Location,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum ArrowFunctionBody<'a> {
    Expression(Box<Expression<'a>>),
    Statements(Vec<Statement<'a>>),
}

// TODO MetaProperty
#[derive(Debug, Clone, PartialEq)]
pub enum Expression<'a> {
    This,
    Super,
    Identifier(Identifier<'a>),
    Literal(Literal<'a>),
    Array {
        elements: Vec<Option<Spreadable<'a, Expression<'a>>>>,
    },
    Object {
        properties: Vec<Spreadable<'a, ObjectProperty<'a>>>,
    },
    Function {
        name: Option<Identifier<'a>>,
        params: Vec<Pattern<'a>>,
        body: Vec<Statement<'a>>,
        metadata: FunctionMetadata,
    },
    // TODO is it possible for these to be generators ?
    ArrowFunction {
        params: Vec<Pattern<'a>>,
        body: ArrowFunctionBody<'a>,
        metadata: FunctionMetadata,
    },
    Unary {
        kind: UnaryKind,
        argument: Box<Expression<'a>>,
    },
    Binary {
        kind: BinaryKind,
        left: Box<Expression<'a>>,
        right: Box<Expression<'a>>,
    },
    Assign {
        kind: AssignKind,
        left: Pattern<'a>,
        right: Box<Expression<'a>>,
    },
    Lookup {
        object: Box<Expression<'a>>,
        property: LookupProperty<'a>,
    },
    If {
        test: Box<Expression<'a>>,
        yes: Box<Expression<'a>>,
        no: Box<Expression<'a>>,
    },
    Call {
        function: Box<Expression<'a>>,
        arguments: Vec<Spreadable<'a, Expression<'a>>>,
    },
    New {
        function: Box<Expression<'a>>,
        arguments: Vec<Spreadable<'a, Expression<'a>>>,
    },
    Comma {
        expressions: Vec<Expression<'a>>,
    },
    Yield {
        argument: Option<Box<Expression<'a>>>,
    },
    YieldAll {
        argument: Option<Box<Expression<'a>>>,
    },
    Await {
        argument: Box<Expression<'a>>,
    },
    Class {
        name: Option<Identifier<'a>>,
        parent: Option<Box<Expression<'a>>>,
        body: Vec<MethodDefinition<'a>>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum Declaration<'a> {
    VariableDeclaration(VariableDeclaration<'a>),
    FunctionDeclaration {
        name: Identifier<'a>,
        params: Vec<Pattern<'a>>,
        body: Vec<Statement<'a>>,
        metadata: FunctionMetadata,
    },
    ClassDeclaration {
        name: Identifier<'a>,
        parent: Option<Expression<'a>>,
        body: Vec<MethodDefinition<'a>>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum Statement<'a> {
    Expression(Expression<'a>),
    Declaration(Declaration<'a>),
    Block {
        statements: Vec<Statement<'a>>,
    },
    Empty,
    Debugger,
    With {
        object: Expression<'a>,
        body: Box<Statement<'a>>,
    },
    Return {
        argument: Option<Expression<'a>>,
    },
    Label {
        label: Identifier<'a>,
        body: Box<Statement<'a>>,
    },
    Break {
        label: Option<Identifier<'a>>,
    },
    Continue {
        label: Option<Identifier<'a>>,
    },
    If {
        test: Expression<'a>,
        yes: Box<Statement<'a>>,
        no: Option<Box<Statement<'a>>>,
    },
    Switch {
        test: Expression<'a>,
        cases: Vec<SwitchCase<'a>>,
    },
    Throw {
        argument: Expression<'a>,
    },
    Try {
        body: Vec<Statement<'a>>,
        catch: Option<TryCatch<'a>>,
        finally: Option<Vec<Statement<'a>>>,
    },
    While {
        test: Expression<'a>,
        body: Box<Statement<'a>>,
    },
    DoWhile {
        body: Box<Statement<'a>>,
        test: Expression<'a>,
    },
    For {
        init: Option<ForInitialize<'a>>,
        test: Option<Expression<'a>>,
        update: Option<Expression<'a>>,
        body: Box<Statement<'a>>,
    },
    ForIn {
        left: ForInPattern<'a>,
        right: Expression<'a>,
        body: Box<Statement<'a>>,
    },
    ForOf {
        left: ForInPattern<'a>,
        right: Expression<'a>,
        body: Box<Statement<'a>>,
        is_await: bool,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum ImportSpecifier<'a> {
    Single {
        local: Identifier<'a>,
        external: Option<Identifier<'a>>,
    },
    Default {
        local: Identifier<'a>,
    },
    Namespace {
        local: Identifier<'a>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct ExportSpecifier<'a> {
    pub local: Identifier<'a>,
    pub external: Identifier<'a>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ModuleStatement<'a> {
    Statement(Statement<'a>),
    Import {
        specifiers: Vec<ImportSpecifier<'a>>,
        filename: String<'a>,
    },
    ExportDeclaration {
        declaration: Declaration<'a>,
    },
    ExportDefault {
        expression: Expression<'a>,
    },
    ExportModule {
        specifiers: Vec<ExportSpecifier<'a>>,
        filename: Option<String<'a>>,
    },
    ExportAll {
        filename: String<'a>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct Module<'a> {
    pub statements: Vec<ModuleStatement<'a>>,
}


#[cfg(test)]
mod tests {
    use super::*;

    const LOC: Location = Location {
        start: Position { offset: 0, column: 0, line: 0 },
        end: Position { offset: 0, column: 0, line: 0 },
    };

    #[test]
    fn test_identifier_normalized_value() {
        assert_eq!(Identifier { raw_value: "\\u0066oo", location: LOC }.normalized_value().as_ref(), "foo");
        assert_eq!(Identifier { raw_value: "\\u{66}oo", location: LOC }.normalized_value().as_ref(), "foo");
    }
}
