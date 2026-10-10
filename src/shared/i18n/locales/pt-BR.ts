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
    rateLimited:
      'A Steam está limitando esta chave por enquanto. A leitura volta sozinha.',
    steamStatus: (status) => `A Steam respondeu com erro ${status}.`,
    unexpected: 'Erro inesperado. Tente de novo.',
    changeNotSaved:
      'Não foi possível salvar a alteração, então ela foi desfeita.',
  },

  validation: {
    steamIdFormat: 'O SteamID é um número de 17 dígitos que começa com 7656.',
    apiKeyFormat:
      'A chave da Web API tem 32 caracteres (letras de A a F e números).',
    languageRequired: 'Escolha um idioma.',
    verificationRequired: 'Verifique a conta antes de continuar.',
  },

  check: {
    privacyBlocked:
      'A Steam não deixou ler seus jogos. Deixe "Detalhes dos jogos" como Público nas configurações de privacidade.',
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

  accounts: {
    gameOnAnotherAccount:
      'Este jogo está rodando em uma conta da Steam que não está no app.',
    lockedWhilePlaying:
      'Enquanto um jogo está rodando, o app fica na conta que está jogando.',
    keyNotEncrypted:
      'Este sistema não tem cofre de senhas, então a chave fica salva sem criptografia, em um arquivo que só o seu usuário pode ler.',
    use: (name: string) => `Usar ${name}`,
    verified: 'Verificada',
    inUse: 'Em uso',
    addAnother: 'Adicionar outra conta',
    removeNamed: (name: string) => `Remover ${name}`,
    title: 'Contas',
    add: 'Adicionar conta',
    status: {
      valid: 'Chave funcionando',
      rejected: 'Chave recusada pela Steam',
      rateLimited: 'A Steam está limitando esta chave',
    },
    keyEnding: (ending: string) => `Chave terminada em ${ending}`,
    showKey: 'Mostrar chave',
    hideKey: 'Ocultar chave',
    key: 'Chave da Web API',
    replaceKey: 'Trocar a chave',
    newKey: 'Nova chave da Web API',
    saveKey: 'Verificar e salvar',
    recheck: 'Verificar de novo',
    remove: 'Remover conta',
    removeTitle: (name: string) => `Remover ${name}?`,
    removeDescription: (name: string) =>
      `A chave de ${name}, o que foi lido da Steam e as notas, checklists e conquistas fixadas dessa conta são apagados deste computador. Nada muda na Steam.`,
    removeConfirm: 'Remover',
    alreadyAdded:
      'Esta conta já foi adicionada. Para mudar a chave dela, use “Trocar a chave” em Configuração.',
    switched: (name: string) =>
      `Agora acompanhando ${name}, a conta conectada na Steam.`,
    keyRefused: (name: string) => `A Steam recusou a chave de ${name}.`,
    keyRefusedHint:
      'O que já foi lido continua na tela. Troque a chave para manter os dados atualizados.',
    keyLimited: (name: string) => `A Steam está limitando a chave de ${name}.`,
    keyLimitedHint:
      'A leitura volta sozinha quando a Steam aceitar a chave de novo.',
  },
  settings: {
    title: 'Configuração',
    steamId: (id) => `SteamID ${id}`,
    language: 'Idioma',
    languageHint:
      'O app recarrega para aplicar o idioma, inclusive nos nomes das conquistas.',
    groups: {
      account: 'Conta',
      window: 'Janela e idioma',
      data: 'Dados e privacidade',
      about: 'Sobre',
    },
    alwaysOnTop: 'Manter a janela sempre no topo',
    alwaysOnTopHint:
      'Fica acima das outras janelas, como um jogo em modo janela.',
    rememberWindow: 'Lembrar o tamanho e a posição da janela',
    privacy:
      'Tudo fica neste computador. O app só fala com a Steam e, para atualizações, com o GitHub.',
    dataFolder: 'Pasta de dados',
    openFolder: 'Abrir pasta',
    copyPath: 'Copiar caminho',
    pathCopied: 'Caminho copiado.',
    errorLog: 'Registro de erros',
    versionLabel: 'Versão',
    source: 'Código-fonte',
    reportIssue: 'Relatar um problema',
    license: 'Licença',
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
    },
    goToStep: (step) => `Ir para ${step}`,

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
    },

    howItWorks:
      'Abra um jogo na Steam e o app troca para ele sozinho. Sem jogo aberto, ele mostra o último que você jogou; o Painel lista todos.',
    finish: 'Entrar no app',
    finishing: 'Salvando…',
  },
};
