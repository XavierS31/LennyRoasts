import { sponsorCategories } from "./engineering/ceremonyResults";

/** Uniform logo frames preserve each supplied mark's proportions and full name. */
export default function JudgingCategoryLabel({ category }: { category: { id: string; name: string } }) {
  const sponsor = sponsorCategories.find((entry) => entry.id === category.id);
  return sponsor ? <span className="sponsor-logo-frame"><img className={`sponsor-logo-${sponsor.id}`} src={sponsor.logo} alt={sponsor.name} width={180} height={60} /></span> : <span>{category.name}</span>;
}
