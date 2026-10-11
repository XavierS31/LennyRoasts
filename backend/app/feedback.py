"""Bounded feedback from validated criteria/evidence; no additional inference."""
import copy

ACTIONS={
    'relevance':'Describe the category-specific behavior and where it enters the working core flow.',
    'originality':'Explain the distinct part of this idea and how it differs from familiar implementations.',
    'tech_understanding':'Describe the connections, data flow and one implementation tradeoff.',
    'functionality':'State which end-to-end flow works now, which steps are disconnected, and one concrete failure to fix.',
    'wow':'Describe the most compelling current feature with a concrete example of its behavior.',
}


def add_feedback(results):
    enriched=copy.deepcopy(results)
    for result in enriched:
        priorities=sorted(result['criteria'],key=lambda k:(result['criteria'][k],k))
        result['improvements']=[f"{key.replace('_',' ').capitalize()} averaged {result['criteria'][key]:.1f}/5 in the three runs. "
            + ('Supporting detail was not described. ' if result['evidence'][key]=='not described' else 'Review the quoted detail in the report. ')
            + ACTIONS[key] for key in priorities[:3] if result['criteria'][key]<5]
    return enriched
