"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, SearchIcon, UsersIcon } from "lucide-react";
import { ToneBadge } from "@/components/tone-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ScreeningStatus } from "@/generated/prisma/enums";
import type { ApplicationRow } from "@/lib/data/applications";
import { EPRA_CLASS, SCREENING_STATUS, SOURCE, STAGE, VERIFICATION } from "@/lib/labels";
import { QUALIFICATION_LEVEL, TRACK } from "@/lib/qualifications";
import { REGION_NAMES } from "@/lib/reference/kenya";

const ALL = "all";

const columns: ColumnDef<ApplicationRow>[] = [
  {
    id: "candidate",
    header: "Candidate",
    accessorFn: (r) => `${r.fullName} ${r.reference} ${r.town}`,
    cell: ({ row: { original: r } }) => (
      <div className="flex flex-col">
        <Link href={`/candidates/${r.id}`} className="font-medium underline-offset-2 hover:underline focus-visible:underline">
          {r.fullName}
        </Link>
        <span className="text-muted-foreground text-xs">
          {r.reference} · {r.town}, {r.county}
        </span>
      </div>
    ),
  },
  { accessorKey: "region", header: "Region", filterFn: "equalsString" },
  { accessorKey: "track", header: "Track", filterFn: "equalsString", cell: ({ getValue }) => TRACK[getValue<ApplicationRow["track"]>()].short },
  {
    id: "licence",
    header: "Licence / qualification",
    accessorFn: (r) => r.epraClass ?? "NONE",
    filterFn: "equalsString",
    cell: ({ row: { original: r } }) => {
      if (r.epraClass && r.epraClass !== "NONE") {
        const v = r.licenceStatus ? VERIFICATION[r.licenceStatus] : null;
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold">EPRA {EPRA_CLASS[r.epraClass]}</span>
            {v && <ToneBadge tone={v.tone}>{v.label}</ToneBadge>}
          </div>
        );
      }
      if (!r.topQualification) return <span className="text-muted-foreground">None listed</span>;
      return (
        <div className="flex items-center gap-2">
          <span className="font-semibold">{QUALIFICATION_LEVEL[r.topQualification].label.split(" (")[0]}</span>
          <ToneBadge tone={r.qualificationsVerified > 0 ? "success" : "warning"}>{r.qualificationsVerified > 0 ? "Verified" : "Pending"}</ToneBadge>
        </div>
      );
    },
  },
  {
    accessorKey: "largestPvKwp",
    header: ({ column }) => <SortButton column={column} label="Largest PV" />,
    cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>().toLocaleString("en-KE")} kWp</span>,
  },
  {
    accessorKey: "score",
    header: ({ column }) => <SortButton column={column} label="Score" />,
    sortUndefined: "last",
    cell: ({ getValue }) => {
      const v = getValue<number | null>();
      return v === null ? <span className="text-muted-foreground">—</span> : <span className="tabular-nums"><strong>{v}</strong>/100</span>;
    },
  },
  {
    accessorKey: "status",
    header: "Screening",
    filterFn: "equalsString",
    cell: ({ getValue }) => {
      const s = getValue<ScreeningStatus | null>();
      if (!s) return <span className="text-muted-foreground">Not scored</span>;
      const meta = SCREENING_STATUS[s];
      return <ToneBadge tone={meta.tone} title={meta.hint}>{meta.label}</ToneBadge>;
    },
  },
  { accessorKey: "stage", header: "Stage", cell: ({ getValue }) => STAGE[getValue<ApplicationRow["stage"]>()] },
  {
    accessorKey: "source",
    header: "Source",
    filterFn: "equalsString",
    cell: ({ getValue }) => <span className="text-muted-foreground">{SOURCE[getValue<ApplicationRow["source"]>()]}</span>,
  },
];

function SortButton({ column, label }: { column: import("@tanstack/react-table").Column<ApplicationRow>; label: string }) {
  const dir = column.getIsSorted();
  const Icon = dir === "asc" ? ArrowUpIcon : dir === "desc" ? ArrowDownIcon : ArrowUpDownIcon;
  return (
    <Button variant="ghost" size="sm" className="-ml-2.5" onClick={() => column.toggleSorting(dir === "asc")}>
      {label} <Icon className="size-3.5" />
    </Button>
  );
}

export function CandidatesTable({ rows }: { rows: ApplicationRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "score", desc: true }]);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState(ALL);
  const [track, setTrack] = useState(ALL);
  const [licence, setLicence] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [source, setSource] = useState(ALL);

  const columnFilters = useMemo(
    () =>
      [
        ["region", region],
        ["track", track],
        ["licence", licence],
        ["status", status],
        ["source", source],
      ]
        .filter(([, v]) => v !== ALL)
        .map(([id, value]) => ({ id, value })),
    [region, track, licence, status, source],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters, globalFilter: query },
    onSortingChange: setSorting,
    globalFilterFn: (row, _id, q: string) => row.getValue<string>("candidate").toLowerCase().includes(q.trim().toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const visible = table.getRowModel().rows;
  const filtered = query || columnFilters.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3" role="search">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, reference or town"
            aria-label="Search candidates"
            className="pl-8"
          />
        </div>
        <Filter label="Region" allLabel="All regions" value={region} onChange={setRegion} options={REGION_NAMES.map((r) => [r, r])} />
        <Filter label="Track" allLabel="All tracks" value={track} onChange={setTrack} options={Object.entries(TRACK).map(([k, v]) => [k, v.short])} />
        <Filter label="Licence class" allLabel="All licence classes" value={licence} onChange={setLicence} options={Object.entries(EPRA_CLASS)} />
        <Filter
          label="Screening"
          allLabel="All screening results"
          value={status}
          onChange={setStatus}
          options={Object.entries(SCREENING_STATUS).map(([k, v]) => [k, v.label])}
        />
        <Filter label="Source" allLabel="All sources" value={source} onChange={setSource} options={Object.entries(SOURCE)} />
        {filtered && (
          <Button variant="ghost" onClick={() => { setQuery(""); setRegion(ALL); setTrack(ALL); setLicence(ALL); setStatus(ALL); setSource(ALL); }}>
            Clear filters
          </Button>
        )}
      </div>

      <div className="bg-card overflow-x-auto rounded-xl border">
        <Table className="min-w-[1080px]">
          <TableHeader className="bg-muted/60">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} aria-sort={h.column.getIsSorted() === "asc" ? "ascending" : h.column.getIsSorted() === "desc" ? "descending" : undefined}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {visible.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {visible.length === 0 && (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-14 text-center">
            <UsersIcon className="size-8" />
            <p className="text-foreground font-medium">{rows.length === 0 ? "No applications yet" : "No candidates match these filters"}</p>
            <p className="text-sm">{rows.length === 0 ? "Run npm run db:seed to load fictional demo records." : "Try clearing a filter."}</p>
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-xs" aria-live="polite">
        Showing {visible.length} of {rows.length} application{rows.length === 1 ? "" : "s"}. Scores are preliminary and need human review.
      </p>
    </div>
  );
}

function Filter({ label, allLabel, value, onChange, options }: { label: string; allLabel: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-full sm:w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
