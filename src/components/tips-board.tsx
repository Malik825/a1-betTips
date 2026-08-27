import { useState } from "react";

export type Tip = {
  match: string;
  league: string;
  time: string;
  tip: string;
  result: "won" | "lost" | "pending";
  score?: string;
};

export const tipsByDay: Record<"Yesterday" | "Today" | "Tomorrow", Tip[]> = {
  Yesterday: [
    { match: "Arsenal vs Brighton", league: "Premier League", time: "19:30", tip: "Over 2.5 Goals", result: "won", score: "3 - 1" },
    { match: "Real Betis vs Girona", league: "LaLiga", time: "21:00", tip: "Home Win (1X2)", result: "won", score: "2 - 0" },
    { match: "Bologna vs Torino", league: "Serie A", time: "18:00", tip: "BTTS - Yes", result: "lost", score: "1 - 0" },
  ],
  Today: [
    { match: "Johor Darul Tazim vs Chelsea", league: "Club Friendly", time: "13:00", tip: "Away 2UP 1UP (1X2)", result: "pending" },
    { match: "FC Epitsentr vs Shakhtar D", league: "Ukraine Premier", time: "15:30", tip: "Away 2UP 1UP (1X2)", result: "pending" },
    { match: "Sporting CP vs Braga", league: "Primeira Liga", time: "20:15", tip: "Over 1.5 Goals", result: "pending" },
  ],
  Tomorrow: [
    { match: "Bayern Munich vs Wolfsburg", league: "Bundesliga", time: "17:30", tip: "Home -1 Handicap", result: "pending" },
    { match: "PSG vs Lens", league: "Ligue 1", time: "20:00", tip: "Over 2.5 Goals", result: "pending" },
  ],
};

const days = ["Yesterday", "Today", "Tomorrow"] as const;

function ResultBadge({ tip }: { tip: Tip }) {
  if (tip.result === "pending") {
    return <span className="font-display text-lg text-muted-foreground">?</span>;
  }
  const won = tip.result === "won";
  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-1 text-xs font-bold uppercase tracking-widest ${
        won ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
      }`}
    >
      {tip.score} {won ? "Won" : "Lost"}
    </span>
  );
}

export function TipsBoard() {
  const [day, setDay] = useState<(typeof days)[number]>("Today");
  const tips = tipsByDay[day];

  return (
    <div className="border border-border/70 bg-card/60">
      <div className="flex border-b border-border/70">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setDay(d)}
            className={`flex-1 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
              day === d
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="hidden grid-cols-[2fr_1.2fr_1fr] gap-4 border-b border-border/70 px-5 py-3 text-[9px] font-bold uppercase tracking-widest text-muted-foreground md:grid">
        <span>Teams</span>
        <span>Tips</span>
        <span className="text-right">Results</span>
      </div>

      <ul className="divide-y divide-border/70">
        {tips.map((tip) => (
          <li
            key={tip.match}
            className="grid gap-3 px-5 py-4 md:grid-cols-[2fr_1.2fr_1fr] md:items-center md:gap-4"
          >
            <div>
              <p className="font-semibold text-foreground">{tip.match}</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {tip.league} · {tip.time}
              </p>
            </div>
            <div className="text-sm font-semibold text-primary">{tip.tip}</div>
            <div className="md:text-right">
              <ResultBadge tip={tip} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}