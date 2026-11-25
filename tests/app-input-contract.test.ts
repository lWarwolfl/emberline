import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

test("solo frames synchronize held input before deciding whether to simulate", () => {
  const source = ts.createSourceFile(
    "app.ts",
    fs.readFileSync(path.resolve(__dirname, "../src/app.ts"), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  let frame: ts.FunctionDeclaration | undefined;
  const find = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "frame") frame = node;
    ts.forEachChild(node, find);
  };
  find(source);
  assert(frame?.body);
  const multiplayerBranch = frame.body.statements.find(
    (node): node is ts.IfStatement =>
      ts.isIfStatement(node) && node.expression.getText(source) === "session.active",
  );
  const solo = multiplayerBranch?.elseStatement;
  assert(solo && ts.isBlock(solo));
  const first = solo.statements[0];
  assert(ts.isExpressionStatement(first));
  assert.equal(first.expression.getText(source), 'syncPose(state.mode === "playing")');
  const simulation = solo.statements[1];
  assert(ts.isIfStatement(simulation));
  assert.equal(simulation.expression.getText(source), 'state.mode === "playing"');
  assert.match(simulation.thenStatement.getText(source), /Engine\.update\(state, dt\)/);
  assert.match(
    source.text,
    /if \(!playing\) \{\s*Input\.release\(\);\s*state\.shield\.held = false;/,
  );
});
