import { production } from "@graysky/oauth-metadata";

export function GET() {
  return Response.json(production);
}
