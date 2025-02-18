import Header from "@/src/components/layouts/header";

import { useRouter } from "next/router";
import ModelTable from "@/src/components/table/use-cases/models";
import { Button } from "@/src/components/ui/button";
import { useHasAccess } from "@/src/features/rbac/utils/checkAccess";
import { Lock } from "lucide-react";
import Link from "next/link";

export default function ModelsPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;
  const hasWriteAccess = useHasAccess({ projectId, scope: "models:CUD" });

  return (
    <div>
      <Header
        title="Models"
        help={{
          description:
            "A model represents a LLM model. It is used to calculate tokens and cost.",
          href: "https://langfuse.com/docs/token-usage",
        }}
        actionButtons={
          <Button disabled={!hasWriteAccess} asChild>
            <Link href={`/project/${projectId}/models/new`}>
              {!hasWriteAccess && <Lock size={16} className="mr-2" />}
              Add model definition{" "}
            </Link>
          </Button>
        }
      />
      <ModelTable projectId={projectId} />
    </div>
  );
}
