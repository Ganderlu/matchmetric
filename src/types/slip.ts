export type SelectionSource = "manual" | "automatic" | "screenshot";

export interface SlipEntry {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoff: string;
  source: SelectionSource;
}
