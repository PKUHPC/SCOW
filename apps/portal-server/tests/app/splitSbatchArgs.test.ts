import { splitSbatchArgs } from "src/utils/app";

it.each([
  [" ", []],
  ["  -o file.out ", ["-o file.out"]],
  ["  --name=file.out", ["--name=file.out"]],
  ["--name=file.out  ", ["--name=file.out"]],
  [" --name=file.out  ", ["--name=file.out"]],
  [" --name=file.out   -o file.out  ", ["--name=file.out", "-o file.out"]],
  [" --job-name=file.out   --time=60  ", ["--job-name=file.out", "--time=60"]],
])("split sbatch options %p to %p", (str: string, expected: string[]) => {
  expect(splitSbatchArgs(str)).toEqual(expected);
});
