// Shared question/feedback flow for in-world orientation scenarios.

/**
 * sc: { id, tag, title, prompt, options:[text...], correct, why, source }
 * opts: { list: progress list name, back: fn to return to the station panel, onCorrect }
 */
export function runScenario(lab, sc, { list = 'scenarios', back, onCorrect } = {}) {
  const done = lab.progress[list].includes(sc.id);
  const letters = 'ABCD';
  const ask = () => lab.ui.setPanel({
    tag: sc.tag || 'Orientation scenario',
    title: sc.title,
    html: `<p>${sc.prompt}</p>${done ? '<p class="src">You have completed this scenario before. Try it again any time.</p>' : ''}`,
    vrText: sc.prompt,
    buttons: [
      ...sc.options.map((o, i) => ({ label: `${letters[i]}. ${o}`, onClick: () => answer(i) })),
      ...(back ? [{ label: '← Back', onClick: back }] : []),
    ],
    foot: 'A learning scenario. Your employer’s local procedures, training and designated contacts always apply.',
  });
  const answer = (i) => {
    const ok = i === sc.correct;
    if (ok) {
      const first = lab.mark(list, sc.id);
      onCorrect?.(first);
      lab.ui.toast(first ? 'Scenario complete' : 'Correct', 'good');
    } else lab.ui.toast('Not quite: read the feedback', 'bad');
    lab.ui.setPanel({
      tag: sc.tag || 'Orientation scenario',
      title: ok ? 'Good call' : 'Think again',
      tone: ok ? 'good' : 'warn',
      html: `<p class="q">${sc.prompt}</p><div class="feedback ${ok ? '' : 'bad'}"><b>${ok ? 'Expected response' : 'Not the safest choice'}</b><br>${ok ? sc.why : `“${sc.options[i]}” could put people, aircraft or cargo at risk. ` + (sc.hint || 'Try another answer.')}</div>${ok && sc.source ? `<p class="src">${sc.source}</p>` : ''}`,
      vrText: ok ? 'Expected response: ' + sc.why : 'Not the safest choice. ' + (sc.hint || 'Try another answer.'),
      buttons: ok ? [{ label: 'Continue', primary: true, onClick: back }] : [{ label: 'Try again', primary: true, onClick: ask }, ...(back ? [{ label: '← Back', onClick: back }] : [])],
    });
  };
  ask();
}
