
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { exportarIngestao } from "./exporter.ts";

const DOENCAS = ["chikungunya", "zika"] as const;

const PASTA_SAIDA = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../../../data/processed/demas",
);

const dataReferencia = new Date().toLocaleDateString("sv-SE", {
	timeZone: "America/Sao_Paulo",
});

async function main(): Promise<void> {
	await mkdir(PASTA_SAIDA, { recursive: true });

	for (const doenca of DOENCAS) {
		console.log(`Iniciando exportação de ${doenca}...`);

		const exportacao = await exportarIngestao(doenca, {
			dataReferencia,
		});

		const caminhoArquivo = resolve(
			PASTA_SAIDA,
			`${doenca}.json`,
		);

		await writeFile(
			caminhoArquivo,
			JSON.stringify(exportacao, null, 2) + "\n",
			"utf-8",
		);

        console.log(`Exportação de ${doenca} concluída.`);
        console.log(`Notificações: ${exportacao.qualidade.total}`);
        console.log(`Arquivo: ${caminhoArquivo}`);
	}
}

try {
	await main();
} catch (erro) {
	console.error("Falha durante a exportação:", erro);
	process.exitCode = 1;
}
