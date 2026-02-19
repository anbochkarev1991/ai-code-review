"use client";

import { useState } from "react";
import type { Repo } from "@/lib/types";
import { PRSelector } from "./pr-selector";
import { RepoSelector } from "./repo-selector";
import { RunReviewButton } from "./run-review-button";

interface RepoAndPRSelectorsProps {
  repos: Repo[];
  accessToken: string;
}

export function RepoAndPRSelectors({ repos, accessToken }: RepoAndPRSelectorsProps) {
  const [selectedRepo, setSelectedRepo] = useState("");
  const [selectedPR, setSelectedPR] = useState("");

  const [owner, repo] = selectedRepo ? selectedRepo.split("/", 2) : ["", ""];

  const handleRepoChange = (fullName: string) => {
    setSelectedRepo(fullName);
    setSelectedPR("");
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <RepoSelector
        repos={repos}
        value={selectedRepo}
        onChange={handleRepoChange}
      />
      {selectedRepo && owner && repo && (
        <>
          <PRSelector
            owner={owner}
            repo={repo}
            accessToken={accessToken}
            value={selectedPR}
            onChange={setSelectedPR}
          />
          {selectedPR && (
            <RunReviewButton
              repoFullName={selectedRepo}
              prNumber={parseInt(selectedPR, 10)}
              accessToken={accessToken}
            />
          )}
        </>
      )}
    </div>
  );
}
