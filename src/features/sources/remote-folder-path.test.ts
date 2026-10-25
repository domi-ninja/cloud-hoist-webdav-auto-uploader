import { expect, it } from "@jest/globals";
import { parseRemoteFolderPath } from "./remote-folder-path";

it("accepts root, nested paths, repeated separators and literal special characters", () => {
  expect(parseRemoteFolderPath("/", [])).toEqual({ segments: [] });
  expect(parseRemoteFolderPath("//Phone Uploads/Photos #1 % 家//", ["Phone Uploads"]))
    .toEqual({ segments: ["Phone Uploads", "Photos #1 % 家"] });
});
it("rejects traversal and paths outside the configured root", () => {
  for (const path of ["/Phone Uploads/../Other", "/Phone Uploads/.", "/Phone Uploads extra", "/", "/Other"]) {
    expect(parseRemoteFolderPath(path, ["Phone Uploads"]).error).toBeDefined();
  }
});
