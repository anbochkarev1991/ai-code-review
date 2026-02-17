"use client";

import { useState } from "react";
import type { Repo } from "@/lib/types";
import { PRSelector } from "./pr-selector";
import { RepoSelector } from "./repo-selector";

interface RepoAndPRSelectorsProps {
  repos: Repo[];
  accessToken: string;
}

export function RepoAndPRSelectors({ repos, accessToken }: RepoAndPRSelectorsProps) {
  const [selectedRepo, setSelectedRepo] = useState("");

  const [owner, repo] = selectedRepo ? selectedRepo.split("/", 2) : ["", ""];

  return (
    <div className="flex w-full flex-col gap-4">
      <RepoSelector
        repos={repos}
        value={selectedRepo}
        onChange={setSelectedRepo}
      />
      {selectedRepo && owner && repo && (
        <PRSelector owner={owner} repo={repo} accessToken={accessToken} />
      )}
    </div>
  );
}
