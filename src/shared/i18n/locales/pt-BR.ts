import type { Messages } from './en';

export const ptBR: Messages = {
  appTitle: 'Conquistas da Steam',

  errors: {
    invalidKey: 'A Steam recusou a chave da Web API.',
    private: 'Os detalhes dos jogos do seu perfil não estão públicos.',
    noStats: 'Este jogo não tem conquistas.',
    notFound: 'Nenhum perfil da Steam encontrado com esse SteamID.',
    network: 'Não foi possível falar com a Steam. Verifique sua conexão.',
    notConfigured: 'O app ainda não foi configurado.',
    steamStatus: (status) => `A Steam respondeu com erro ${status}.`,
    unexpected: 'Erro inesperado. Tente de novo.',
  },

  validation: {
    steamIdFormat: 'O SteamID tem 17 dígitos e começa com 7656119.',
    apiKeyFormat:
      'A chave da Web API tem 32 caracteres (letras de A a F e números).',
    languageRequired: 'Escolha um idioma.',
    privacyRequired: 'Faça a verificação de privacidade antes de concluir.',
  },

  check: {
    profileNotFound: 'A Steam não encontrou nenhum perfil com esse SteamID.',
    privacyBlocked:
      'A Steam não deixou ler seus jogos. Deixe "Detalhes dos jogos" como Público nas configurações de privacidade.',
    reasonNetwork: 'não foi possível falar com a Steam',
    reasonStatus: (status) => `a Steam respondeu com erro ${status}`,
    reasonSteamSaid: (text) => `a Steam respondeu: ${text}`,
    reasonUnexpected: 'a Steam devolveu uma resposta inesperada',
  },

  toast: {
    title: (game) => `Conquista desbloqueada — ${game}`,
    body: (achievement, left) =>
      `${achievement} · ${left === 0 ? 'todas as conquistas obtidas!' : `faltam ${left}`}`,
  },

  guides: {
    query: 'como conseguir',
    steam: 'Guias',
    steamTitle: 'Buscar nos guias da comunidade Steam',
    searchOn: (site) => `Buscar no ${site}`,
  },

  nav: {
    game: 'Jogo',
    dashboard: 'Painel',
    settings: 'Configuração',
    pinWindow: 'Manter a janela sempre no topo',
    unpinWindow: 'Deixar de manter a janela no topo',
  },

  common: {
    cancel: 'Cancelar',
    retry: 'Tentar de novo',
    refresh: 'Atualizar',
    back: 'Voltar',
    next: 'Próximo',
    clearSearch: 'Limpar busca',
    openInBrowser: 'Abrir no navegador',
  },

  game: {
    none: 'Nenhum jogo aberto e nenhum jogo jogado ainda. Escolha um no Painel.',
    loading: 'Carregando conquistas…',
    running: 'em execução',
    summary: (unlocked, total, percent) =>
      `${unlocked} de ${total} conquistas · ${percent}%`,
    left: (n) => `faltam ${n}`,
    allUnlocked: 'todas obtidas',
    justUnlocked: (names) => `Conquista desbloqueada: ${names}`,
    noAchievements: 'Este jogo não tem conquistas.',
    pending: (n) => `Pendentes ${n}`,
    unlocked: (n) => `Obtidas ${n}`,
    search: 'Buscar conquista por nome ou descrição',
    sort: {
      common: 'Mais comuns primeiro',
      rare: 'Mais raras primeiro',
      closest: 'Mais perto de concluir',
      name: 'Nome',
    },
    nothingFound: (query) => `Nada encontrado para “${query}”.`,
    nothingPending: 'Nada pendente. 100%!',
    nothingUnlocked: 'Nenhuma conquista obtida ainda.',
  },

  card: {
    hidden: 'oculta',
    rarityTitle: 'Jogadores que têm esta conquista',
    noDescription: 'Sem descrição.',
    steamCounter: 'Contador da Steam',
    checklistCounter: 'Itens marcados no seu checklist',
    unlockedOn: (date) => `Obtida em ${date}`,
    list: 'Lista',
    listTitle: 'Checklist do que falta',
    note: 'Anotar',
    notePlaceholder: 'Sua anotação ou um link de guia',
    pin: 'Fixar no topo',
    unpin: 'Desafixar',
  },

  checklist: {
    rename: 'Clique para renomear',
    remove: 'Remover item',
    newItem: 'Novo item',
    add: 'Adicionar item',
    paste: 'Colar lista',
    duplicate: 'Esse item já está na lista.',
    pasteDescription: (achievement) =>
      `Cole os itens de um guia para “${achievement}”, um por linha. Marcadores e numeração são removidos.`,
    pastePlaceholder: 'Item 1\nItem 2\nItem 3',
    addButton: 'Adicionar',
    addCount: (n) => `Adicionar ${n} ${n === 1 ? 'item' : 'itens'}`,
  },

  dashboard: {
    title: 'Painel',
    refreshAll: 'Atualizar tudo',
    reading: (done, total) => `Lendo conquistas: ${done} de ${total} jogos…`,
    loadingLibrary: 'Carregando sua biblioteca…',
    summary: (games, complete, ongoing) =>
      `${games} jogos com conquistas · ${complete} completos · ${ongoing} em andamento`,
    search: 'Buscar jogo',
    nothingFound: (query) => `Nenhum jogo encontrado para “${query}”.`,
    empty: 'Nenhum jogo jogado com conquistas.',
    complete: 'completo',
    left: (n) => `faltam ${n}`,
  },

  settings: {
    title: 'Configuração',
    account: 'Conta Steam',
    steamId: (id) => `SteamID ${id}`,
    language: 'Idioma',
    languageHint:
      'O app recarrega para aplicar o idioma, inclusive nos nomes das conquistas.',
    redo: 'Refazer a configuração',
    erase: 'Apagar chave e SteamID',
    eraseTitle: 'Apagar chave e SteamID?',
    eraseDescription:
      'O app volta para a configuração inicial. Suas notas, checklists e conquistas fixadas são mantidas.',
    eraseConfirm: 'Apagar',
  },

  onboarding: {
    steps: {
      language: 'Idioma',
      account: 'Conta',
      apiKey: 'Chave',
      privacy: 'Privacidade',
      done: 'Pronto',
    },
    loading: 'Carregando…',
    redoNotice: (reason) => `${reason} Refaça a configuração.`,

    language: {
      title: 'Conquistas da Steam',
      description:
        'Veja o que falta desbloquear no jogo que você está jogando.',
      intro:
        'Este app mostra, para o jogo que você está jogando, quais conquistas faltam, o que são as ocultas, quanto falta nas que têm contador e atalhos para guias.',
      before: 'Antes de usar, três coisas rápidas:',
      items: [
        'confirmar qual é a sua conta (SteamID);',
        'gerar uma chave da Web API da Steam, gratuita;',
        'conferir se os detalhes dos seus jogos estão públicos.',
      ],
      keyStaysLocal: 'A chave fica guardada só neste computador.',
      label: 'Idioma',
      start: 'Começar',
    },

    account: {
      title: 'Sua conta',
      description: 'Qual conta da Steam o app deve acompanhar?',
      detected:
        'Encontrei a conta logada no cliente Steam deste computador. Confirme se é a sua.',
      notDetected:
        'Não encontrei uma conta logada no cliente Steam. Cole abaixo o seu SteamID de 17 dígitos.',
      helpTitle: 'Onde encontro meu SteamID?',
      help: [
        'No cliente Steam, clique no seu nome no canto superior direito.',
        'Escolha “Detalhes da conta”.',
        'O número de 17 dígitos em “ID Steam”, logo abaixo do nome da conta, é o seu SteamID. Não é o código de amigo nem o nome de usuário.',
      ],
      openAccount: 'Abrir “Detalhes da conta” no navegador',
      label: 'SteamID',
      found: 'Perfil encontrado',
      unconfirmed: (reason) =>
        `Não consegui confirmar este perfil agora (${reason}). Você pode tentar de novo ou continuar: o próximo passo confere o SteamID junto com a chave.`,
      verify: 'Verificar',
      verifying: 'Verificando…',
      mine: 'É a minha conta',
      continueAnyway: 'Continuar mesmo assim',
    },

    apiKey: {
      title: 'Chave da Web API',
      description: 'A Steam pede uma chave para compartilhar suas conquistas.',
      steps: [
        'Abra a página de chaves da Steam.',
        'Entre com a sua conta. Em “Nome de domínio”, digite qualquer coisa, por exemplo localhost.',
        'Aceite os termos, clique em Registrar e copie a chave de 32 caracteres.',
      ],
      label: 'Chave',
      placeholder: 'Cole a chave aqui',
      verify: 'Verificar chave',
      verifying: 'Verificando…',
    },

    privacy: {
      title: 'Privacidade do perfil',
      description: 'O app só consegue ler conquistas de um perfil público.',
      testing: 'Testando o acesso às suas conquistas…',
      ok: 'Tudo certo: a Steam liberou a leitura das suas conquistas.',
      steps: [
        'Abra as configurações de privacidade.',
        'Deixe “Meu perfil” e “Detalhes dos jogos” como Público.',
        'Volte aqui e teste de novo (a Steam pode levar um minuto para aplicar).',
      ],
      testAgain: 'Testar de novo',
    },

    done: {
      title: 'Pronto',
      description: 'A configuração está completa.',
      found: (n) =>
        `Encontrei ${n} ${n === 1 ? 'jogo já jogado' : 'jogos já jogados'} na sua conta.`,
      howItWorks:
        'Abra um jogo na Steam e o app troca para ele sozinho. Sem jogo aberto, ele mostra o último que você jogou; o Painel lista todos.',
      saveFailed:
        'Não foi possível salvar a configuração. Volte e confira a chave.',
      finish: 'Entrar no app',
      saving: 'Salvando…',
    },
  },
};
