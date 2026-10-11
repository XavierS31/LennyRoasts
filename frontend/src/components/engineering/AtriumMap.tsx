import { useState } from "react";
import { columnRows, tableRows, projectStation } from "./atriumLayout";
import { sponsorRooms, type SponsorRoomId } from "./classroomLayout";

export default function AtriumMap({ projectNames, onRoom }: { projectNames: string[]; onRoom: (id: SponsorRoomId) => void }) {
  const [open, setOpen] = useState(false);
  const point = (x: number, z: number) => [120 + x * 3, 174 + z * 3.2];
  return <aside className="atrium-map glass-panel" aria-label="Atrium photo relationships">
    <button type="button" aria-expanded={open} aria-controls="atrium-reference-map" onClick={() => setOpen((value) => !value)}>Room map {open ? "−" : "+"}</button>
    <div id="atrium-reference-map" hidden={!open}>
      <svg viewBox="0 0 240 350" role="img" aria-label="Glass entrance at one end, stairs at the opposite end, brick and cream walls facing each other, eight columns and two table lanes">
        <rect x="42" y="34" width="156" height="280" rx="4" fill="#d7d1bd" />
        <path d="M42 34V314" stroke="#a66d58" strokeWidth="8" />
        <path d="M198 34V314" stroke="#f5ead1" strokeWidth="8" />
        <path d="M42 34H198" stroke="#90cddb" strokeWidth="7" />
        <path d="M52 291H186L57 278H183L60 265H181" stroke="#6d7477" strokeWidth="5" fill="none" />
        {columnRows.flatMap((z) => [-14, 14].map((x) => {
          const [cx, cy] = point(x, z); return <circle key={`${x}:${z}`} cx={cx} cy={cy} r="7" fill="#e3b844" stroke="#5c676b" strokeWidth="2" />;
        }))}
        {tableRows.flatMap((z) => [-6, 6].map((x) => {
          const [cx, cy] = point(x, z); return <ellipse key={`${x}:${z}`} cx={cx} cy={cy} rx="10" ry="7" fill="#fffdf1" stroke="#8d9290" />;
        }))}
        {projectNames.map((name, index) => {
          const [x, z] = projectStation(index), [cx, cy] = point(x, z);
          return <g key={`${index}:${name}`}><title>{index === 0 ? "Your idea: " : "API rival: "}{name}</title><circle cx={cx} cy={cy} r="4" fill={index === 0 ? "#f3bd34" : "#3d89a7"} stroke="#27343b" /></g>;
        })}
        <g fill="#374553" fontFamily="inherit" fontSize="10" textAnchor="middle">
          <text x="120" y="20">Glass entrance · photos 1–2</text>
          <text x="120" y="338">Stairs · photos 4–6</text>
          <text x="16" y="180" transform="rotate(-90 16 180)">Brick + window bands</text>
          <text x="225" y="180" transform="rotate(90 225 180)">Cream wall + banners</text>
        </g>
      </svg>
      <div className="map-rooms" role="group" aria-label="Judging rooms">
        {sponsorRooms.map((room) => <button key={room.id} type="button" onClick={() => onRoom(room.id)}><span style={{ background: room.color }} aria-hidden="true" />{room.name}</button>)}
      </div>
      <small>Gold: your idea · blue: returned rivals. Select a judging room to enter.</small>
    </div>
  </aside>;
}
