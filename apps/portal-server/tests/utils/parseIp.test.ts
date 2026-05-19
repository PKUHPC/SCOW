import { parseIp } from "src/utils/proxy";

const stdout = `PING cn01 (172.58.1.111) 56(84) bytes of data.
64 bytes from cn01 (172.58.1.111): icmp_seq=1 ttl=64 time=0.154 ms

--- cn01 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.154/0.154/0.154/0.000 ms`;

it("parses IP address from stdout", () => {
  const ip = parseIp(stdout);
  expect(ip).toBe("172.58.1.111");
});
