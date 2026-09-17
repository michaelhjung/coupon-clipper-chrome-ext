import { AUTHOR_URL, GITHUB_URL, KO_FI_URL } from "../shared/constants";

export const Footer = ({ showGithub = false }: { showGithub?: boolean }) => (
  <p className="muted mt-4 text-center text-xs">
    by{" "}
    <a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer">
      Michael Jung
    </a>
    {" · "}
    <a href={KO_FI_URL} target="_blank" rel="noopener noreferrer">
      ☕ Support on Ko-fi
    </a>
    {showGithub && (
      <>
        {" · "}
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </>
    )}
  </p>
);
