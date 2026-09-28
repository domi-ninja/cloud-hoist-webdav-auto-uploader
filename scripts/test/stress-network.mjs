// HTTPS CONNECT tunnel: preserves TLS, resolves host-only DNS, and bounds emulator throughput.
import { createServer } from "node:http";
import { connect } from "node:net";
import { Transform } from "node:stream";

export async function createStressNetwork(
  hostname,
  address,
  upstreamPort = 443,
) {
  const sockets = new Set();
  const stats = {
    connections: 0,
    bytes: 0,
    outages: 0,
    rejectedConnections: 0,
    upstreamFailures: 0,
  };
  let offline = false;
  const server = createServer((_req, res) => {
    res.writeHead(502);
    res.end();
  });
  const limit = () =>
    new Transform({
      transform(chunk, _encoding, callback) {
        stats.bytes += chunk.length;
        setTimeout(
          () => callback(null, chunk),
          Math.max(15, Math.ceil((chunk.length / (96 * 1024)) * 1000)),
        );
      },
    });
  server.on("connect", (request, client, head) => {
    if (offline || request.url !== `${hostname}:${upstreamPort}`) {
      stats.rejectedConnections += 1;
      client.destroy();
      return;
    }
    stats.connections += 1;
    const upstream = connect(upstreamPort, address);
    upstream.on("error", () => {
      stats.upstreamFailures += 1;
    });
    for (const socket of [client, upstream]) {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.on("error", () => {
        client.destroy();
        upstream.destroy();
      });
      socket.setTimeout(60_000, () => socket.destroy());
    }
    upstream.once("connect", () => {
      setTimeout(() => {
        if (client.destroyed || offline) {
          upstream.destroy();
          return;
        }
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        client.pipe(limit()).pipe(upstream);
        upstream.pipe(limit()).pipe(client);
      }, 750);
    });
    client.on("close", () => upstream.destroy());
    upstream.on("close", () => client.destroy());
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: server.address().port,
    stats,
    setOffline(value) {
      offline = value;
      if (value) {
        stats.outages += 1;
        for (const socket of sockets) socket.destroy();
      }
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
