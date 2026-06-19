import http from "node:http";

const port = Number(process.env.E2E_OPENCERTS_VERIFY_PORT ?? 4010);

const server = http.createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (request.method !== "POST" || request.url !== "/verify") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  request.resume();
  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      summary: {
        all: true,
        documentIntegrity: true,
        documentStatus: true,
        issuerIdentity: true
      },
      data: [
        { type: "DOCUMENT_INTEGRITY", name: "E2E stub", status: "VALID" },
        { type: "DOCUMENT_STATUS", name: "E2E stub", status: "VALID" },
        { type: "ISSUER_IDENTITY", name: "E2E stub", status: "VALID" }
      ]
    })
  );
});

server.listen(port, "127.0.0.1", () => {
  console.log(`OpenCerts verify stub listening on ${port}`);
});
