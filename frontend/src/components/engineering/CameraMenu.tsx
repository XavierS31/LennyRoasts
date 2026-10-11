import { useEffect, useId, useRef, useState } from "react";
import type { CameraCommand, SceneKind } from "./EngineeringScene";
import { lennySponsors } from "./lennyLayout";
import { EyeIcon, PlusIcon, MinusIcon, ArrowCounterClockwiseIcon, CompassIcon, MapTrifoldIcon, BuildingOfficeIcon, BuildingsIcon, ArrowLeftIcon, PersonSimpleWalkIcon, ChairIcon, StepsIcon, SunIcon, DoorOpenIcon, RobotIcon, BankIcon, MicrophoneIcon, StackIcon, TrophyIcon, LightbulbIcon, type Icon } from "@phosphor-icons/react";

type View = { action: CameraCommand; icon: Icon; label: string; sponsor?: string };

export default function CameraMenu({ kind, onCamera, onSponsor }: {
  kind: SceneKind;
  onCamera: (action: CameraCommand) => void;
  onSponsor: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  const views: View[] = [
    { action: "in", icon: PlusIcon, label: "Zoom in" },
    { action: "out", icon: MinusIcon, label: "Zoom out" },
    { action: "reset", icon: ArrowCounterClockwiseIcon, label: "Reset view" },
    { action: "iso", icon: CompassIcon, label: kind === "campus" ? "Orbit view" : kind === "atrium" ? "Balcony view" : "Room overview" },
    { action: "top", icon: MapTrifoldIcon, label: kind === "campus" ? "Top view" : "Whole floor" },
    ...(kind === "campus" ? [
      { action: "front" as const, icon: BuildingOfficeIcon, label: "Front view" },
      { action: "tower" as const, icon: BuildingsIcon, label: "Tower detail" },
      { action: "west" as const, icon: ArrowLeftIcon, label: "Left wing" },
      { action: "walk" as const, icon: PersonSimpleWalkIcon, label: "Entrance walk" },
      { action: "health" as const, icon: BuildingOfficeIcon, label: "Health Sciences" },
      { action: "service" as const, icon: BuildingsIcon, label: "Service side" },
      { action: "alley" as const, icon: PersonSimpleWalkIcon, label: "Campus lane" },
      { action: "junction" as const, icon: BuildingOfficeIcon, label: "Rear junction" },
    ] : kind === "atrium" ? [
      { action: "floor" as const, icon: ChairIcon, label: "Table level" },
      { action: "stairs" as const, icon: StepsIcon, label: "Staircase" },
      { action: "ceiling" as const, icon: SunIcon, label: "Skylights" },
      { action: "entrance" as const, icon: DoorOpenIcon, label: "Glass entrance" },
      ...lennySponsors.map((sponsor, index) => ({ action: "sponsor" as const,
        icon: [RobotIcon, BankIcon, MicrophoneIcon, StackIcon][index], label: `Visit ${sponsor.name} Lenny`, sponsor: sponsor.id })),
    ] : [
      { action: "floor" as const, icon: PersonSimpleWalkIcon, label: "Center aisle" },
      { action: "stage" as const, icon: TrophyIcon, label: "Award stage" },
      { action: "ceiling" as const, icon: LightbulbIcon, label: "Ceiling detail" },
    ]),
  ];

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <div className={`camera-menu ${open ? "is-open" : ""}`} ref={root}>
    <button type="button" className="camera-menu-toggle glass-panel" ref={toggle}
      aria-label="Camera views" aria-expanded={open} aria-controls={id} title="Camera views"
      onClick={() => setOpen((value) => !value)}><EyeIcon size={27} weight="light" aria-hidden="true" /></button>
    <div className="camera-menu-tray glass-panel" id={id} inert={!open} aria-hidden={!open}>
      <div className="camera-menu-grid" role="group" aria-label="Camera controls">
        {views.map((view, index) => <button type="button" className="camera-action" key={view.sponsor ?? view.action}
          aria-label={view.label} aria-describedby={`${id}-${index}`} onClick={() => view.sponsor ? onSponsor(view.sponsor) : onCamera(view.action)}>
          <view.icon size={24} weight="light" aria-hidden="true" />
          <span className="control-tooltip" role="tooltip" id={`${id}-${index}`}>{view.label}</span>
        </button>)}
      </div>
    </div>
  </div>;
}
