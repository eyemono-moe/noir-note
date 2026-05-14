type RuleContext = {
  report: (diagnostic: { node: unknown; message: string }) => void;
  sourceCode: {
    getCommentsBefore: (node: unknown) => CommentNode[];
  };
};

type CommentNode = {
  loc?: {
    end?: { line?: number };
  };
};

type IdentifierNode = {
  type: "Identifier";
  name: string;
};

type ImportSpecifierNode = {
  type: "ImportSpecifier";
  imported?: IdentifierNode;
  local?: IdentifierNode;
};

type ImportDeclarationNode = {
  type: "ImportDeclaration";
  source?: { value?: unknown };
  specifiers?: ImportSpecifierNode[];
};

type CallExpressionNode = {
  type: "CallExpression";
  callee?: IdentifierNode | { type: string };
  parent?: AstNode;
  loc?: {
    start?: { line?: number };
  };
};

type AstNode =
  | ImportDeclarationNode
  | CallExpressionNode
  | { type: string; parent?: AstNode; loc?: CallExpressionNode["loc"] };

function isIdentifier(node: unknown): node is IdentifierNode {
  return typeof node === "object" && node !== null && "type" in node && node.type === "Identifier";
}

function getLocalCreateEffectName(specifier: ImportSpecifierNode) {
  if (specifier.type !== "ImportSpecifier" || specifier.imported?.name !== "createEffect") {
    return null;
  }

  return specifier.local?.name ?? null;
}

function hasAdjacentComment(context: RuleContext, node: CallExpressionNode) {
  const target = node.parent ?? node;
  const comments = [
    ...context.sourceCode.getCommentsBefore(target),
    ...context.sourceCode.getCommentsBefore(node),
  ];
  const startLine = node.loc?.start?.line;

  if (startLine === undefined) {
    return comments.length > 0;
  }

  return comments.some((comment) => {
    const endLine = comment.loc?.end?.line;
    return endLine !== undefined && startLine - endLine <= 1;
  });
}

const requireCreateEffectComment = {
  create(context: RuleContext) {
    const solidCreateEffectNames = new Set<string>();

    return {
      ImportDeclaration(node: ImportDeclarationNode) {
        if (node.source?.value !== "solid-js") {
          return;
        }

        for (const specifier of node.specifiers ?? []) {
          const localName = getLocalCreateEffectName(specifier);
          if (localName) {
            solidCreateEffectNames.add(localName);
          }
        }
      },
      CallExpression(node: CallExpressionNode) {
        if (!isIdentifier(node.callee) || !solidCreateEffectNames.has(node.callee.name)) {
          return;
        }

        if (hasAdjacentComment(context, node)) {
          return;
        }

        context.report({
          node,
          message: "createEffect requires an adjacent intent comment.",
        });
      },
    };
  },
};

export default {
  meta: { name: "noir-note" },
  rules: {
    "require-create-effect-comment": requireCreateEffectComment,
  },
};
