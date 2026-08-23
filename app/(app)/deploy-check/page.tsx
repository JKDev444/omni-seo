import { DeployCheckForm } from "@/components/DeployCheckForm";

export default function DeployCheckPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Deploy Check</h1>
          <p className="page-subtitle">Check a theme change before you publish it — no staging server required</p>
        </div>
      </div>
      <DeployCheckForm />
    </div>
  );
}
