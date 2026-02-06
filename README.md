# 🌍 Geo Cluster

Aplicação web para análise e agrupamento geoespacial de cidades usando o algoritmo K-Means com processamento paralelo via Web Workers.

## 📋 Sobre

Geo Cluster permite explorar, selecionar e agrupar cidades do mundo inteiro com base em suas coordenadas geográficas. A aplicação utiliza o algoritmo K-Means otimizado com Web Workers para processar milhares de cidades sem travar a interface, exibindo os resultados em um mapa interativo.

### ✨ Funcionalidades

- 🔍 Exploração de cidades por repositório local (90.000+) ou via API GeoDB Cities
- 📊 Algoritmo K-Means paralelo com Web Workers
- 🗺️ Visualização interativa dos clusters em mapa (Leaflet)
- 💾 Persistência local das cidades selecionadas
- 🎨 Interface moderna e responsiva com Tailwind CSS

## 🚀 Tecnologias

- **Next.js 16** + **React 19** + **TypeScript**
- **Tailwind CSS 4** para estilização
- **Leaflet** + **React-Leaflet** para mapas
- **Web Workers API** para processamento paralelo

## 🔧 Como Rodar

### Pré-requisitos

- Node.js 20+
- npm/yarn/pnpm

### Instalação

```bash
# Clone o repositório
git clone https://github.com/heitorbrrt1/geo-cluster.git
cd geo-cluster

# Instale as dependências
npm install

# Execute em modo de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

### Scripts

```bash
npm run dev    # Desenvolvimento
npm run build  # Build para produção
npm run start  # Servidor de produção
npm run lint   # Linter
```

## 📝 Como Usar

1. **Selecione cidades**: Use o explorador local ou busque via API
2. **Configure o K**: Defina o número de clusters desejados
3. **Execute K-Means**: Clique no botão e aguarde o processamento
4. **Visualize**: Explore os clusters no mapa interativo

---