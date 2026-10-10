"""Prepare a bounded follow-up to observed response-length and category failures."""
import argparse
import copy
import json
from pathlib import Path
import hf_probe as m


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=m.ROOT / '.local-tests/qwen-v2-casebook.json')
    parser.add_argument('--output', type=Path, default=m.ROOT / '.local-tests/qwen-v3-casebook.json')
    args = parser.parse_args()
    args.input = args.input.resolve()
    args.output = args.output.resolve()
    if not all(path.is_relative_to(m.ROOT / '.local-tests') for path in [args.input, args.output]):
        parser.error('Inputs and outputs must stay under the Git-ignored .local-tests directory')
    if not args.input.is_file():
        parser.error('Local input missing. See experiments/README.md for the required input format.')
    original = json.loads(args.input.read_text())
    ids = {
        'judge_gemini_cookquest_0', 'judge_gemini_cookquest_wordy_0',
        'judge_gemini_cookquest_partial_0', 'judge_elevenlabs_cookquest_0',
        'judge_elevenlabs_knightsource_0', 'judge_best_game_cookquest_0',
        'judge_overall_cookquest_0', 'judge_gemini_synthetic_strong_0',
        'judge_gemini_synthetic_wordy_0',
    }
    book = []
    for case in original:
        if case['id'] not in ids:
            continue
        case = copy.deepcopy(case)
        case['max_tokens'] = 1200
        case['schema']['properties']['rationale']['maxLength'] = 500
        for field in case['schema']['properties']['evidence']['properties'].values():
            field['maxLength'] = 120
        case['messages'][0]['content'] += '''
    OUTPUT CONTRACT: rationale must be a plain-language explanation in at most two
    sentences and 500 characters, not an encoded JSON object, score table, or repeated
    evidence list. Each evidence value must be a verbatim, contiguous substring of
    the submission, at most 120 characters, without field labels, surrounding quote
    marks, invented text, or ellipses. Use "not described" where no supporting text
    exists. Put quoted evidence only in evidence, not again in rationale.
    '''
        if case['track'] == 'best_game':
            case['messages'][0]['content'] = case['messages'][0]['content'].replace(
                'Relevance: 1 absent, 2 incidental/swappable role, 3 meaningful secondary role,\n4 central role, 5 built around the challenge technology.',
                'Game relevance: 1 no gameplay described; 2 a game label but no explained game mechanics;\n3 some described player objectives or gameplay choices; 4 gameplay is central;\n5 the whole project showcases gameplay.')
            case['messages'][0]['content'] += '''
    BEST GAME OVERRIDE: Relevance is gameplay fit, never use of AI, VR, Unity, or voice
    technology. A recipe assistant or immersive interface without described player
    objectives, rules, game choices, or a gameplay loop has relevance 1 and is
    ineligible. Cite actual gameplay mechanics or "not described". Do not invent
    gameplay from a project name or its technology stack.
    '''
        book.append(case)
    path = args.output
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(book, indent=2, ensure_ascii=False) + '\n')
    print(f'Prepared {len(book)} bounded follow-up cases: {path}')


if __name__ == "__main__":
    main()
