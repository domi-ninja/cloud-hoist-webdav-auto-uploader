import { expect, it } from "@jest/globals";
import { completeServerUrl } from "./server-url";

it.each([
  ["cloud.domi.ninja", "https://cloud.domi.ninja"],
  [" cloud.example.com:8443/nextcloud ", "https://cloud.example.com:8443/nextcloud"],
  ["//cloud.example.com", "https://cloud.example.com"],
  ["https://cloud.example.com", "https://cloud.example.com"],
  ["http://cloud.example.com", "http://cloud.example.com"],
  ["ftp://cloud.example.com", "ftp://cloud.example.com"],
  ["", ""],
])("completes %s without overriding an explicit protocol", (input, expected) => {
  expect(completeServerUrl(input)).toBe(expected);
});
