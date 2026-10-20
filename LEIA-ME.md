# Financeiro Hipokids

App de controle financeiro da Hipokids: lançamento de vendas, contas a pagar, contas a receber, lembretes de vencimento e painel com os números do mês. Funciona no celular como um aplicativo instalado, com o ícone do hipopótamo.

## O que tem nesta pasta

| Arquivo | Para que serve |
|---|---|
| `index.html`, `app.css`, `app.js` | O aplicativo |
| `config.js` | Onde entram o endereço e a chave do Supabase |
| `schema.sql` | Cria as tabelas, a segurança e as categorias no banco |
| `manifest.webmanifest`, `sw.js` | Deixam o site instalável no celular |
| `icon-*.png`, `apple-touch-icon.png`, `favicon-*.png`, logos | Ícones e identidade visual |

## Testar agora, sem banco

Para ver o app sem banco, esvazie os dois campos do `config.js` e abra o `index.html` no navegador. Sem nada preenchido, o app roda em **modo de teste** e guarda os dados só naquele aparelho. Serve para conhecer as telas. Não use para a operação real, porque os dados não vão para a nuvem.

## Colocar no ar

O banco já está criado no Supabase da conta da Andressa (projeto na organização HipoKids Moda Infantil), com tabelas, segurança e categorias prontas, e o `config.js` já aponta para ele. Faltam estes passos:

1. **Fechar o cadastro.** No painel do Supabase, em Authentication, Sign In / Providers, Email, desligue a opção de permitir novos cadastros. Assim só entra quem você criar.
2. **Criar os dois usuários.** Em Authentication, Users, Add user, crie o e-mail e a senha da Andressa e os seus (marque a opção de confirmar o e-mail automaticamente).
3. **Liberar o acesso.** Em SQL Editor, rode:
   `insert into public.membros (user_id) select id from auth.users on conflict do nothing;`
4. **Publicar.** Suba a pasta inteira em uma hospedagem gratuita com HTTPS (Netlify, Cloudflare Pages ou GitHub Pages). O HTTPS é obrigatório para instalar como aplicativo.
5. **Instalar no celular.** Abra o endereço no Chrome (Android) ou Safari (iPhone) e use "Adicionar à tela inicial".

O passo 3 só funciona depois que os usuários do passo 2 existem. Se rodar antes, ninguém consegue entrar.

## Como o app funciona

- **Venda de hoje (tela Início):** um campo de valor e o canal. Serve para lançar cada venda na hora ou o total do dia, a Andressa decide. "Outra data ou mais detalhes" abre o formulário completo.
- **Pagar:** contas com vencimento. Pode ser única, parcelada (ex.: empréstimo em 10 vezes) ou mensal por 12 meses (ex.: cartão, MEI). O botão **Pagar** dá baixa com um toque e dá para desfazer.
- **Receber:** vendas fiadas, parceladas e cartão a cair. Lance a venda fiada aqui, e não em Vendas, para não contar duas vezes. Quando o dinheiro chega, toque em **Receber**.
- **Painel:** resultado do mês, vendas por canal, despesas por categoria, ritmo de vendas, últimos 6 meses e quanto já está comprometido nos próximos 30 dias. O resultado considera o que foi realmente pago e recebido dentro do mês.
- **Próximas 4 semanas (Início):** compara o que entra e o que sai em cada semana, para ver antes se uma conta vence antes do dinheiro da feira.
- **Menu:** categorias de despesa, aviso de vencimentos, planilha CSV (abre no Excel) e backup completo.

## Limites desta primeira versão

- **Lembretes:** o aviso aparece quando o app é aberto, uma vez por dia, para contas atrasadas, de hoje e de amanhã. Aviso com o app fechado exige uma etapa a mais (e-mail ou WhatsApp automático) e fica para a próxima fase.
- **Sem internet:** o app abre, mas lançar e consultar dados precisa de conexão.
- **Backup:** o plano gratuito do Supabase não garante backup automático. Baixe a planilha ou o backup completo no menu uma vez por mês.
- **Estoque:** a tabela `produtos` já existe no banco, mas ainda não tem tela.
