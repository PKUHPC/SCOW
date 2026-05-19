import { parseDisplayId, parseListOutput, parseOtp } from "src/utils/turbovnc";

const startOutput1 = `
Desktop 'TurboVNC: login01:1 (2001213077)' started on display login01:1

One-Time Password authentication enabled.  Generating initial OTP ...
Full control one-time password: 67159149
Run '/opt/TurboVNC/bin/vncpasswd -o' from within the TurboVNC session or
    '/opt/TurboVNC/bin/vncpasswd -o -display :1' from within this shell
    to generate additional OTPs
Starting applications specified in ./xstartup
Log file is /nfs/2001213077/.vnc/login01:1.log
`;

const startOutput2 = `
Desktop 'TurboVNC: cn1:21 (demo_admin)' started on display cn1:21

One-Time Password authentication enabled.  Generating initial OTP ...
Full control one-time password: 17486286
Run '/opt/TurboVNC/bin/vncpasswd -o' from within the TurboVNC session or
    '/opt/TurboVNC/bin/vncpasswd -o -display :21' from within this shell
    to generate additional OTPs
Starting applications specified in ./xstartup
Log file is ./vnc.log

`;

it.each([
  [startOutput1, 1],
  [startOutput2, 21],
])("parses display id from output", async (output, expected) => {
  expect(parseDisplayId(output)).toBe(expected);
});

it.each([
  ["Full control one-time password: 32582749", "32582749"],
  [startOutput1, "67159149"],
])("parses OTP from output", async (output, expected) => {
  expect(parseOtp(output)).toBe(expected);
});

const listOutput = `
TurboVNC sessions:

X DISPLAY #     PROCESS ID      NOVNC PROCESS ID
:1\t\t21468
:2\t\t22284
:21\t\t22222
`;

it.each([[listOutput, [1, 2, 21]]])("parses list", (output, expected) => {
  expect(parseListOutput(output)).toIncludeSameMembers(expected);
});
