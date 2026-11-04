import { describe, expect, it } from "vitest";
import SwaggerParser from "swagger-parser";
import { createOpenApiDocument } from "../src/operations/openapi";
describe("published API contract", () => {
  it("validates all local schema references with the existing Swagger parser", async () => {
    const doc = createOpenApiDocument();
    await expect(
      SwaggerParser.validate(JSON.parse(JSON.stringify(doc))),
    ).resolves.toBeDefined();
  });
  it("documents sensitive request boundaries and optional-auth content", () => {
    const doc = createOpenApiDocument();
    expect(doc.paths["/v1/api/payments/checkout"].post.security).toEqual([
      { bearerAuth: [], clientId: [] },
    ]);
    expect(doc.paths["/v1/api/payments/stripe/webhook"].post.security).toEqual([
      { stripeSignature: [] },
    ]);
    expect(doc.paths["/v1/api/authors/{authorId}/posts"].get.security).toEqual([
      {},
      { bearerAuth: [], clientId: [] },
    ]);
    expect(
      doc.paths["/v1/api/access/setup-password"].post.responses,
    ).toHaveProperty("201");
    for (const url of [
      "/library/history",
      "/authors/me/analytics",
      "/admin/content/{kind}/{id}",
      "/chat/conversations/{id}/messages",
      "/upload/fan-art/confirm",
    ])
      expect(doc.paths[`/v1/api${url}`]).toBeDefined();
  });
});
