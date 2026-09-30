import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/advisor")({
  beforeLoad: () => {
    throw redirect({ to: "/research" });
  },
});
