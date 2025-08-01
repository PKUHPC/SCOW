import { trpc } from "src/utils/trpc";

export default function QuantumTaskListPage() {

  const { data, isLoading } = trpc.backend.task.findTask.useQuery({
    state: "active",
    accountName: "_",
  });

  return (
    <div>
      <h1>Quantum Task List</h1>
      <p>This page will display the list of quantum tasks.</p>
    </div>
  );
}
