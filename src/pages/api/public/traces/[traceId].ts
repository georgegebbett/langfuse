import { verifyAuthHeaderAndReturnScope } from "@/src/features/public-api/server/apiAuth";
import { cors, runMiddleware } from "@/src/features/public-api/server/cors";
import { mapUsageOutput } from "@/src/features/public-api/server/outputSchemaConversion";
import { prisma } from "@/src/server/db";
import { type NextApiRequest, type NextApiResponse } from "next";
import { z } from "zod";

const GetTraceSchema = z.object({
  traceId: z.string(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await runMiddleware(req, res, cors);

  if (req.method !== "GET") {
    console.error(req.method, req.body, req.query);
    return res.status(405).json({ message: "Method not allowed" });
  }

  // CHECK AUTH
  const authCheck = await verifyAuthHeaderAndReturnScope(
    req.headers.authorization,
  );
  if (!authCheck.validKey)
    return res.status(401).json({
      message: authCheck.error,
    });
  // END CHECK AUTH

  try {
    console.log("Trying to get trace:", req.body, req.query);

    const { traceId } = GetTraceSchema.parse(req.query);

    // CHECK ACCESS SCOPE
    if (authCheck.scope.accessLevel !== "all") {
      return res.status(401).json({
        message:
          "Access denied - need to use basic auth with secret key to GET traces",
      });
    }
    // END CHECK ACCESS SCOPE

    const trace = await prisma.trace.findFirst({
      where: {
        id: traceId,
        projectId: authCheck.scope.projectId,
      },
      include: {
        scores: true,
      },
    });

    if (!trace) {
      return res.status(404).json({
        message: "Trace not found within authorized project",
      });
    }

    const observations = await prisma.observation.findMany({
      where: {
        traceId: traceId,
        projectId: authCheck.scope.projectId,
      },
    });

    return res
      .status(200)
      .json({ ...trace, observations: observations.map(mapUsageOutput) });
  } catch (error: unknown) {
    console.error(error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    res.status(400).json({
      message: "Invalid request data",
      error: errorMessage,
    });
  }
}
