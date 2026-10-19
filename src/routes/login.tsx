import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/lumen/LoginPage";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/login")({
  head: pageHead("Sign in", "Access GREEN Limited's knowledge and document workspace."),
  component: LoginPage,
});
