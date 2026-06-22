import Phaser from 'phaser';

const INTERACTION_PANEL_HEIGHT = 260;
const INTERACTION_PANEL_WIDTH = 540;
const PANEL_MARGIN = 16;

export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create() {
    this.caseState = {
      title: 'Loading case...',
      knownClues: [],
      witnessStatements: []
    };

    this.createClock();
    this.createInteractionPanel();
    this.createQuestionForm();
    this.createNotebook();
    this.createNotice();

    this.game.events.on('ui:state', this.updateState, this);
    this.game.events.on('ui:case', this.updateCase, this);
    this.game.events.on('ui:questionPrompt', this.showQuestionPrompt, this);
    this.game.events.on('ui:interactionLoading', this.showLoading, this);
    this.game.events.on('ui:interaction', this.showInteraction, this);
    this.game.events.on('ui:notice', this.showNotice, this);
    this.scale.on('resize', this.layout, this);

    this.layout();
    this.renderNotebook();
  }

  createClock() {
    this.clockPanel = this.add
      .rectangle(16, 16, 116, 38, 0x0f172a, 0.86)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(100);
    this.clockText = this.add
      .text(32, 25, '--:--', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f8fafc'
      })
      .setScrollFactor(0)
      .setDepth(101);
  }

  createInteractionPanel() {
    this.interactionPanel = this.add
      .rectangle(PANEL_MARGIN, 0, INTERACTION_PANEL_WIDTH, INTERACTION_PANEL_HEIGHT, 0x111827, 0.92)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(100);
    this.interactionTitle = this.add
      .text(32, 0, 'Chronopolis', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#f8fafc'
      })
      .setScrollFactor(0)
      .setDepth(101);
    this.interactionMeta = this.add
      .text(32, 0, 'Python simulation online when backend is running', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#cbd5e1',
        lineSpacing: 2,
        wordWrap: { width: INTERACTION_PANEL_WIDTH - 48 }
      })
      .setScrollFactor(0)
      .setDepth(101);
    this.interactionDialogue = this.add
      .text(32, 0, 'Press E near an NPC to question them.', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#e2e8f0',
        lineSpacing: 3,
        wordWrap: { width: INTERACTION_PANEL_WIDTH - 48 }
      })
      .setScrollFactor(0)
      .setDepth(101);
  }

  createQuestionForm() {
    this.questionForm = document.createElement('form');
    this.questionForm.style.position = 'fixed';
    this.questionForm.style.zIndex = '20';
    this.questionForm.style.display = 'none';
    this.questionForm.style.gap = '8px';
    this.questionForm.style.alignItems = 'center';
    this.questionForm.style.padding = '10px';
    this.questionForm.style.background = 'rgba(15, 23, 42, 0.94)';
    this.questionForm.style.border = '1px solid rgba(148, 163, 184, 0.35)';
    this.questionForm.style.boxSizing = 'border-box';

    this.questionInput = document.createElement('input');
    this.questionInput.type = 'text';
    this.questionInput.maxLength = 180;
    this.questionInput.style.flex = '1';
    this.questionInput.style.minWidth = '0';
    this.questionInput.style.height = '34px';
    this.questionInput.style.border = '1px solid rgba(148, 163, 184, 0.45)';
    this.questionInput.style.background = '#0f172a';
    this.questionInput.style.color = '#f8fafc';
    this.questionInput.style.font = '13px monospace';
    this.questionInput.style.padding = '0 10px';
    this.questionInput.style.outline = 'none';

    this.askButton = document.createElement('button');
    this.askButton.type = 'submit';
    this.askButton.textContent = 'Ask';
    this.askButton.style.height = '34px';
    this.askButton.style.border = '0';
    this.askButton.style.background = '#38bdf8';
    this.askButton.style.color = '#082f49';
    this.askButton.style.font = '700 13px monospace';
    this.askButton.style.padding = '0 14px';
    this.askButton.style.cursor = 'pointer';

    this.cancelButton = document.createElement('button');
    this.cancelButton.type = 'button';
    this.cancelButton.textContent = 'Cancel';
    this.cancelButton.style.height = '34px';
    this.cancelButton.style.border = '1px solid rgba(148, 163, 184, 0.45)';
    this.cancelButton.style.background = 'transparent';
    this.cancelButton.style.color = '#cbd5e1';
    this.cancelButton.style.font = '13px monospace';
    this.cancelButton.style.padding = '0 12px';
    this.cancelButton.style.cursor = 'pointer';

    this.questionForm.append(this.questionInput, this.askButton, this.cancelButton);
    document.body.appendChild(this.questionForm);

    this.questionForm.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submitQuestion();
    });
    this.cancelButton.addEventListener('click', () => this.cancelQuestion());
    this.questionForm.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        this.cancelQuestion();
      }
    });
  }

  createNotebook() {
    this.notebookPanel = this.add
      .rectangle(0, 16, 326, 360, 0x172033, 0.9)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(100);
    this.notebookText = this.add
      .text(0, 32, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#e5e7eb',
        lineSpacing: 5,
        wordWrap: { width: 286 }
      })
      .setScrollFactor(0)
      .setDepth(101);
  }

  createNotice() {
    this.notice = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#fde68a',
        backgroundColor: 'rgba(17, 24, 39, 0.88)',
        padding: { x: 10, y: 8 },
        wordWrap: { width: 420 }
      })
      .setScrollFactor(0)
      .setDepth(120)
      .setVisible(false);
  }

  layout() {
    const { width, height } = this.scale;
    const compact = width < 900;
    const notebookWidth = compact ? Math.max(width - 32, 280) : 326;
    const interactionWidth = compact
      ? Math.min(Math.max(width - 32, 280), INTERACTION_PANEL_WIDTH)
      : INTERACTION_PANEL_WIDTH;
    const panelTop = height - INTERACTION_PANEL_HEIGHT - PANEL_MARGIN;

    this.clockPanel.setPosition(16, 16);
    this.clockText.setPosition(32, 25);

    this.notebookPanel.setSize(notebookWidth, compact ? 276 : 360);
    this.notebookPanel.setPosition(width - notebookWidth - 16, 16);
    this.notebookText.setPosition(width - notebookWidth, 32);
    this.notebookText.setWordWrapWidth(notebookWidth - 40);

    this.interactionPanel.setSize(interactionWidth, INTERACTION_PANEL_HEIGHT);
    this.interactionPanel.setPosition(PANEL_MARGIN, panelTop);
    this.interactionTitle.setPosition(32, panelTop + 18);
    this.interactionMeta.setPosition(32, panelTop + 50);
    this.interactionMeta.setWordWrapWidth(interactionWidth - 48);
    this.interactionDialogue.setPosition(32, panelTop + 132);
    this.interactionDialogue.setWordWrapWidth(interactionWidth - 48);

    if (this.questionForm) {
      this.questionForm.style.left = `${PANEL_MARGIN}px`;
      this.questionForm.style.bottom = `${INTERACTION_PANEL_HEIGHT + 24}px`;
      this.questionForm.style.width = `${interactionWidth}px`;
      this.questionForm.style.display = this.questionFormVisible ? 'flex' : 'none';
    }

    this.notice.setPosition(16, 70);
  }

  updateState(state) {
    this.clockText.setText(state.time || '--:--');
    if (state.case) {
      this.updateCase(state.case);
    }
  }

  updateCase(caseState) {
    this.caseState = caseState;
    this.renderNotebook();
  }

  showQuestionPrompt(data) {
    this.activeQuestionNpc = data;
    this.questionFormVisible = true;
    this.questionInput.value = '';
    this.questionInput.placeholder = `Ask ${data.npcName} about their alibi, rumors, or schedule`;
    this.interactionTitle.setText(data.npcName);
    this.interactionMeta.setText([data.job, data.location].filter(Boolean).join('\n'));
    this.interactionDialogue.setText('Ask your question.');
    this.layout();
    requestAnimationFrame(() => this.questionInput.focus());
  }

  submitQuestion() {
    const question = this.questionInput.value.trim() || 'What have you noticed today?';
    const npcName = this.activeQuestionNpc?.npcName;
    if (!npcName) {
      return;
    }

    this.questionFormVisible = false;
    this.layout();
    this.game.events.emit('ui:questionSubmit', { npcName, question });
  }

  cancelQuestion() {
    this.questionFormVisible = false;
    this.activeQuestionNpc = null;
    this.layout();
    this.game.events.emit('ui:questionCancel');
  }

  showLoading(data) {
    this.interactionTitle.setText(data.npcName);
    this.interactionMeta.setText([data.job, data.location].filter(Boolean).join('\n'));
    this.interactionDialogue.setText('Questioning...');
  }

  showInteraction(data) {
    this.activeQuestionNpc = null;
    this.interactionTitle.setText(data.npcName);
    this.interactionMeta.setText([data.job, data.location].filter(Boolean).join('\n'));
    this.interactionDialogue.setText(data.dialogue);
  }

  renderNotebook() {
    const npcProfiles = this.caseState.npcProfiles?.length
      ? this.caseState.npcProfiles
          .map(
            (npc) =>
              `- ${npc.name}: ${npc.mood} S${npc.suspicion} R${npc.rapport}`
          )
          .join('\n')
      : '- No NPC profiles yet';
    const clues = this.caseState.knownClues?.length
      ? this.caseState.knownClues.map((clue) => `- ${clue.text}`).join('\n')
      : '- No clues revealed yet';
    const statements = this.caseState.witnessStatements?.length
      ? this.caseState.witnessStatements
          .slice(0, 4)
          .map((statement) => `- ${statement.npcName}: ${statement.text}`)
          .join('\n')
      : '- No witness statements yet';

    this.notebookText.setText(
      `DETECTIVE NOTEBOOK\n\nCurrent case\n${this.caseState.title}\n\nKnown NPCs\n${npcProfiles}\n\nKnown clues\n${clues}\n\nWitness statements\n${statements}`
    );
  }

  showNotice(notice) {
    this.notice.setText(`${notice.title}: ${notice.message}`);
    this.notice.setVisible(true);
    this.time.delayedCall(6000, () => this.notice.setVisible(false));
  }

  shutdown() {
    this.game.events.off('ui:state', this.updateState, this);
    this.game.events.off('ui:case', this.updateCase, this);
    this.game.events.off('ui:questionPrompt', this.showQuestionPrompt, this);
    this.game.events.off('ui:interactionLoading', this.showLoading, this);
    this.game.events.off('ui:interaction', this.showInteraction, this);
    this.game.events.off('ui:notice', this.showNotice, this);
    this.questionForm?.remove();
  }
}
