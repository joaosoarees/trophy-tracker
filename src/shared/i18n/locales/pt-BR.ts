import type { Messages } from './en';

export const ptBR: Messages = {
  appTitle: 'Trophy Tracker',
  notAffiliated: 'Sem afiliação com a Valve ou a Steam.',

  crash: {
    title: 'Algo deu errado',
    description:
      'Não foi possível mostrar esta tela. Recarregar costuma resolver; os detalhes foram gravados no registro de erros.',
    reload: 'Recarregar',
  },

  errors: {
    invalidKey: 'A Steam recusou a chave da Web API.',
    private: 'Os detalhes dos jogos do seu perfil não estão públicos.',
    noStats: 'Este jogo não tem conquistas.',
    notFound: 'Nenhum perfil da Steam encontrado com esse SteamID.',
    network: 'Não foi possível falar com a Steam. Verifique sua conexão.',
    notConfigured: 'O app ainda não foi configurado.',
    steamStatus: (status) => `A Steam respondeu com erro ${status}.`,
    unexpected: 'Erro inesperado. Tente de novo.',
    changeNotSaved:
      'Não foi possível salvar a alteração, então ela foi desfeita.',
  },

  validation: {
    steamIdFormat: 'O SteamID tem 17 dígitos e começa com 7656119.',
    apiKeyFormat:
      'A chave da Web API tem 32 caracteres (letras de A a F e números).',
    languageRequired: 'Escolha um idioma.',
    verificationRequired: 'Verifique a conta antes de continuar.',
  },

  check: {
    privacyBlocked:
      'A Steam não deixou ler seus jogos. Deixe "Detalhes dos jogos" como Público nas configurações de privacidade.',
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
    label: 'Principal',
    pinWindow: 'Manter a janela sempre no topo',
    unpinWindow: 'Deixar de manter a janela no topo',
    updateAvailable: (version) => `Versão ${version} disponível`,
  },

  common: {
    cancel: 'Cancelar',
    undo: 'Desfazer',
    close: 'Fechar',
    dismiss: 'Dispensar',
    retry: 'Tentar de novo',
    refresh: 'Atualizar',
    back: 'Voltar',
    next: 'Próximo',
    clearSearch: 'Limpar busca',
    openInBrowser: 'Abrir no navegador',
    sortBy: 'Ordenar por',
  },

  game: {
    none: 'Nenhum jogo aberto e nenhum jogo jogado ainda. Escolha um no Painel.',
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
    hiddenOnly: (n) => `Ocultas ${n}`,
    hiddenOnlyTitle: 'Mostrar só as conquistas ocultas',
    sort: {
      common: 'Mais comuns primeiro',
      rare: 'Mais raras primeiro',
      closest: 'Mais perto de concluir',
      recent: 'Mais recentes primeiro',
      oldest: 'Mais antigas primeiro',
      name: 'Nome',
    },
    nothingFound: (query) => `Nada encontrado para “${query}”.`,
    inOtherList: {
      pending: (n) =>
        `${n} ${n === 1 ? 'resultado' : 'resultados'} em Pendentes`,
      unlocked: (n) =>
        `${n} ${n === 1 ? 'resultado' : 'resultados'} em Obtidas`,
    },
    filterLabel: 'Conquistas mostradas',
    justCompleted: 'Todas as conquistas desbloqueadas!',
    details: {
      toggle: 'Detalhes',
      progress: 'Seu progresso',
      left: 'O que falta',
      playtime: 'Tempo de jogo',
      lastPlayed: 'Jogado pela última vez',
      lastUnlocked: 'Última conquista',
      easiest: 'Mais fácil',
      rarest: 'Mais rara',
      closest: 'Mais perto de concluir',
      never: 'Ainda não',
    },
    complete: {
      title: 'Todas as conquistas desbloqueadas',
      completedOn: (date) => `Concluído em ${date}`,
      rarest: (name, percent) =>
        `Mais rara: ${name} · ${percent} dos jogadores`,
      seeUnlocked: 'Ver o que você desbloqueou',
    },
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
    rename: 'Renomear item',
    removed: (text) => `“${text}” removido`,
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
    filterLabel: 'Jogos mostrados',
    refreshAll: 'Atualizar tudo',
    reading: (done, total) => `Lendo conquistas: ${done} de ${total} jogos…`,
    loadingLibrary: 'Carregando sua biblioteca…',
    ongoing: (n) => `Em andamento ${n}`,
    complete: (n) => `Completos ${n}`,
    sort: {
      closest: 'Mais perto dos 100%',
      played: 'Jogados recentemente',
      fewest: 'Menos conquistas faltando',
      name: 'Nome',
      completed: 'Completados recentemente',
    },
    nothingOngoing: 'Nenhum jogo em andamento.',
    nothingComplete: 'Nenhum jogo completo ainda.',
    inOtherList: {
      ongoing: (n) =>
        `${n} ${n === 1 ? 'resultado' : 'resultados'} em Em andamento`,
      complete: (n) =>
        `${n} ${n === 1 ? 'resultado' : 'resultados'} em Completos`,
    },
    achievementCount: (n) => `${n} ${n === 1 ? 'conquista' : 'conquistas'}`,
    search: 'Buscar jogo',
    nothingFound: (query) => `Nenhum jogo encontrado para “${query}”.`,
    empty: 'Nenhum jogo jogado com conquistas.',
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
    groups: {
      account: 'Conta',
      window: 'Janela e idioma',
      data: 'Dados e privacidade',
      about: 'Sobre',
    },
    redoAction: 'Refazer',
    redoHint: 'Passa pela configuração de novo. Suas notas são mantidas.',
    eraseHint: 'Esquece a chave e o SteamID neste computador.',
    alwaysOnTop: 'Manter a janela sempre no topo',
    alwaysOnTopHint:
      'Fica acima das outras janelas, como um jogo em modo janela.',
    rememberWindow: 'Lembrar o tamanho e a posição da janela',
    notifyUnlocks: 'Avisar quando uma conquista for desbloqueada',
    privacy:
      'Tudo fica neste computador. O app só fala com a Steam e, para atualizações, com o GitHub.',
    dataFolder: 'Pasta de dados',
    openFolder: 'Abrir pasta',
    copyPath: 'Copiar caminho',
    pathCopied: 'Caminho copiado.',
    errorLog: 'Registro de erros',
    errorLogHint:
      'Fica em logs/errors.log, dentro da pasta de dados. Nunca é enviado a lugar algum.',
    versionLabel: 'Versão',
    source: 'Código-fonte',
    reportIssue: 'Relatar um problema',
    license: 'Licença',
    version: (version) => `Versão ${version}`,
    updateAvailable: (version) => `A versão ${version} está disponível`,
    updateHint: 'Baixe e instale por cima desta; seus dados são mantidos.',
    download: 'Baixar',
    updateDownloading: (version) => `Baixando a versão ${version}…`,
    updateReady: (version) => `A versão ${version} está pronta para instalar`,
    updateReadyHint:
      'O app reinicia para concluir a atualização; seus dados são mantidos.',
    restart: 'Reiniciar para atualizar',
    updateBlockedHint:
      'O Controle Inteligente de Aplicativos do Windows está ativo e bloqueia instaladores sem assinatura digital, que este ainda não tem. A versão instalada continua funcionando.',
    learnMore: 'Saiba mais',
    checkForUpdates: 'Buscar atualizações',
    checkingForUpdates: 'Buscando…',
    upToDate: 'Você já tem a versão mais recente.',
    updateCheckFailed: 'Não foi possível verificar. Confira sua conexão.',
  },

  update: {
    checking: 'Buscando atualizações…',
    found: (version) => `Versão ${version} encontrada`,
    downloading: (percent) => `Baixando… ${percent}%`,
    restartNotice:
      'O app reinicia sozinho quando o download terminar. Seus dados são mantidos.',
    readyTitle: (version) => `A versão ${version} foi baixada`,
    readyDescription:
      'O app precisa reiniciar para concluir a atualização. Seus dados são mantidos.',
    restartNow: 'Reiniciar agora',
    later: 'Depois',
    available: (version) => `A versão ${version} está disponível`,
    see: 'Ver',
  },

  onboarding: {
    steps: {
      language: 'Idioma',
      account: 'Conta',
      done: 'Pronto',
    },
    goToStep: (step) => `Ir para ${step}`,
    redoNotice: (reason) => `${reason} Refaça a configuração.`,

    language: {
      title: 'Trophy Tracker',
      description:
        'Veja o que falta desbloquear no jogo que você está jogando.',
      intro:
        'Este app mostra, para o jogo que você está jogando, quais conquistas faltam, o que são as ocultas, quanto falta nas que têm contador e atalhos para guias.',
      before: 'Para configurar você vai precisar de:',
      items: [
        'o seu SteamID, que o app costuma encontrar sozinho;',
        'uma chave da Web API da Steam, gratuita;',
        'os detalhes dos seus jogos como públicos no seu perfil da Steam.',
      ],
      keyStaysLocal: 'A chave fica guardada só neste computador.',
      label: 'Idioma',
      start: 'Começar',
    },

    account: {
      title: 'Sua conta',
      description: 'A conta da Steam a acompanhar e a chave para lê-la.',
      steamId: {
        label: 'SteamID',
        detected: 'Detectado no cliente Steam deste computador.',
        saved: 'A conta com que este app está configurado.',
        notDetected:
          'Não encontrei uma conta logada no cliente Steam. Cole o seu SteamID de 17 dígitos.',
        change: 'Usar outra conta',
        helpTitle: 'Onde encontro meu SteamID?',
        help: [
          'No cliente Steam, clique no seu nome no canto superior direito.',
          'Escolha “Detalhes da conta”.',
          'O número de 17 dígitos em “ID Steam”, logo abaixo do nome da conta, é o seu SteamID. Não é o código de amigo nem o nome de usuário.',
        ],
        openAccount: 'Abrir “Detalhes da conta” no navegador',
      },
      key: {
        label: 'Chave da Web API',
        placeholder: 'Cole a chave aqui',
        helpTitle: 'Como consigo uma chave?',
        help: [
          'Abra a página de chaves da Steam.',
          'Entre com a sua conta. Em “Nome de domínio”, digite qualquer coisa, por exemplo localhost.',
          'Aceite os termos, clique em Registrar e copie a chave de 32 caracteres.',
        ],
        openPage: 'Abrir a página de chaves no navegador',
      },
      privacy: {
        help: [
          'Abra as configurações de privacidade.',
          'Deixe “Meu perfil” e “Detalhes dos jogos” como Público.',
          'Volte aqui e teste de novo (a Steam pode levar um minuto para aplicar).',
        ],
        openSettings: 'Abrir as configurações de privacidade no navegador',
        testAgain: 'Testar de novo',
      },
      verify: 'Verificar',
      verifying: 'Verificando…',
      verified: (games) =>
        `Verificado · ${games} ${games === 1 ? 'jogo já jogado' : 'jogos já jogados'}`,
      locked: 'Para usar outra conta ou chave, clique em Alterar.',
      change: 'Alterar',
    },

    done: {
      title: 'Pronto',
      description: 'A configuração está completa.',
      found: (n) =>
        `Encontrei ${n} ${n === 1 ? 'jogo já jogado' : 'jogos já jogados'} na sua conta.`,
      account: 'Conta',
      language: 'Idioma',
      howItWorks:
        'Abra um jogo na Steam e o app troca para ele sozinho. Sem jogo aberto, ele mostra o último que você jogou; o Painel lista todos.',
      saveFailed:
        'Não foi possível salvar a configuração. Volte e verifique a conta de novo.',
      finish: 'Entrar no app',
      saving: 'Salvando…',
    },
  },
};
