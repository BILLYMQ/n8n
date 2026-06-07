<script lang="ts" setup>
import { ref, computed } from 'vue';
import { N8nButton, N8nBadge } from '@n8n/design-system';
import { useDocumentTitle } from '@/app/composables/useDocumentTitle';
import { useToast } from '@/app/composables/useToast';
import JobApplicationCard from '../components/JobApplicationCard.vue';
import {
	useCareerApplicationsStore,
	type ApplicationStatus,
	type JobApplication,
} from '../stores/careerApplications.store';

useDocumentTitle('Candidatures Indeed');

const store = useCareerApplicationsStore();
const toast = useToast();

type StatusFilter = 'all' | ApplicationStatus;

const activeFilter = ref<StatusFilter>('all');
const showImportModal = ref(false);
const showCvModal = ref(false);
const selectedApplication = ref<JobApplication | null>(null);
const importText = ref('');
const importError = ref('');

const FILTER_LABELS: Record<StatusFilter, string> = {
	all: 'Toutes',
	to_apply: 'À postuler',
	applied: 'Postulé',
	rejected: 'Refusé',
	interview: 'Entretien',
};

const filtered = computed(() => {
	if (activeFilter.value === 'all') return store.applications;
	return store.applications.filter((a) => a.status === activeFilter.value);
});

function handleImport() {
	importError.value = '';
	let parsed: unknown;
	try {
		parsed = JSON.parse(importText.value.trim());
	} catch {
		importError.value = 'JSON invalide — copiez le résultat exact du nœud "Retourner résultats".';
		return;
	}

	const array = Array.isArray(parsed)
		? parsed
		: ((parsed as Record<string, unknown>).candidatures ?? [parsed]);

	const count = store.importFromWorkflow(array as unknown[]);
	if (count === 0) {
		importError.value = 'Aucune nouvelle candidature détectée (doublons ignorés).';
		return;
	}

	toast.showMessage({
		title: `${count} candidature${count > 1 ? 's' : ''} importée${count > 1 ? 's' : ''}`,
		type: 'success',
	});

	importText.value = '';
	showImportModal.value = false;
}

function openCv(application: JobApplication) {
	selectedApplication.value = application;
	showCvModal.value = true;
}

async function copyToClipboard(text: string) {
	await navigator.clipboard.writeText(text);
	toast.showMessage({ title: 'CV copié dans le presse-papiers', type: 'success' });
}
</script>

<template>
	<div :class="$style.page">
		<!-- Header -->
		<div :class="$style.pageHeader">
			<div :class="$style.titleRow">
				<h1 :class="$style.pageTitle">Mes candidatures Indeed</h1>
				<N8nBadge v-if="store.counts.total > 0" type="info">
					{{ store.counts.total }}
				</N8nBadge>
			</div>
			<N8nButton type="primary" @click="showImportModal = true">
				Importer depuis le workflow
			</N8nButton>
		</div>

		<!-- Filters -->
		<div v-if="store.counts.total > 0" :class="$style.filters">
			<button
				v-for="(label, key) in FILTER_LABELS"
				:key="key"
				:class="[$style.filterBtn, { [$style.filterActive]: activeFilter === key }]"
				@click="activeFilter = key"
			>
				{{ label }}
				<span v-if="key !== 'all' && store.counts[key] > 0" :class="$style.filterCount">
					{{ store.counts[key] }}
				</span>
			</button>
		</div>

		<!-- Empty state -->
		<div v-if="store.counts.total === 0" :class="$style.empty">
			<div :class="$style.emptyIcon">💼</div>
			<h2 :class="$style.emptyTitle">Aucune candidature</h2>
			<p :class="$style.emptyDesc">
				Lancez le workflow <strong>CV Job Tailor — Indeed</strong> depuis n8n,<br />
				puis importez les résultats ici.
			</p>
			<N8nButton type="primary" @click="showImportModal = true">
				Importer mes candidatures
			</N8nButton>
		</div>

		<!-- Grid -->
		<div v-else-if="filtered.length > 0" :class="$style.grid">
			<JobApplicationCard
				v-for="app in filtered"
				:key="app.id"
				:application="app"
				@status-change="store.updateStatus"
				@remove="store.remove"
				@view-cv="openCv"
			/>
		</div>

		<!-- No results for current filter -->
		<div v-else :class="$style.empty">
			<p :class="$style.emptyDesc">Aucune candidature avec ce statut.</p>
			<N8nButton type="secondary" @click="activeFilter = 'all'">
				Voir toutes les candidatures
			</N8nButton>
		</div>

		<!-- Import Modal -->
		<Teleport to="body">
			<div v-if="showImportModal" :class="$style.overlay" @click.self="showImportModal = false">
				<div :class="$style.modal">
					<div :class="$style.modalHeader">
						<h2 :class="$style.modalTitle">Importer depuis le workflow</h2>
						<button :class="$style.closeBtn" @click="showImportModal = false">✕</button>
					</div>
					<p :class="$style.modalDesc">
						Dans n8n, copiez le JSON retourné par le nœud
						<strong>"Retourner résultats"</strong> et collez-le ci-dessous.
					</p>
					<textarea
						v-model="importText"
						:class="$style.jsonInput"
						placeholder='[{"poste": "...", "entreprise": "...", "cv_adapte": "..."}]'
						rows="10"
					/>
					<p v-if="importError" :class="$style.errorMsg">{{ importError }}</p>
					<div :class="$style.modalActions">
						<N8nButton type="secondary" @click="showImportModal = false">Annuler</N8nButton>
						<N8nButton type="primary" :disabled="!importText.trim()" @click="handleImport">
							Importer
						</N8nButton>
					</div>
				</div>
			</div>
		</Teleport>

		<!-- CV Modal -->
		<Teleport to="body">
			<div
				v-if="showCvModal && selectedApplication"
				:class="$style.overlay"
				@click.self="showCvModal = false"
			>
				<div :class="[$style.modal, $style.cvModal]">
					<div :class="$style.modalHeader">
						<div>
							<h2 :class="$style.modalTitle">CV adapté</h2>
							<p :class="$style.modalSubtitle">
								{{ selectedApplication.jobTitle }} — {{ selectedApplication.company }}
							</p>
						</div>
						<div :class="$style.modalHeaderActions">
							<N8nButton
								size="small"
								type="secondary"
								@click="copyToClipboard(selectedApplication.tailoredCv)"
							>
								Copier
							</N8nButton>
							<button :class="$style.closeBtn" @click="showCvModal = false">✕</button>
						</div>
					</div>
					<pre :class="$style.cvContent">{{ selectedApplication.tailoredCv }}</pre>
				</div>
			</div>
		</Teleport>
	</div>
</template>

<style lang="scss" module>
.page {
	max-width: 1200px;
	margin: 0 auto;
	padding: var(--spacing--xl) var(--spacing--lg);
	display: flex;
	flex-direction: column;
	gap: var(--spacing--lg);
}

.pageHeader {
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-wrap: wrap;
	gap: var(--spacing--sm);
}

.titleRow {
	display: flex;
	align-items: center;
	gap: var(--spacing--sm);
}

.pageTitle {
	font-size: var(--font-size--2xl);
	font-weight: var(--font-weight--bold);
	color: var(--color--text-dark);
	margin: 0;
}

.filters {
	display: flex;
	gap: var(--spacing--xs);
	flex-wrap: wrap;
}

.filterBtn {
	display: flex;
	align-items: center;
	gap: var(--spacing--3xs);
	padding: var(--spacing--xs) var(--spacing--sm);
	border: 1px solid var(--color--foreground-light);
	border-radius: var(--border-radius--base);
	background: var(--color--background-light);
	cursor: pointer;
	font-size: var(--font-size--sm);
	color: var(--color--text-base);
	transition: all 0.15s ease;

	&:hover {
		border-color: var(--color--primary);
		color: var(--color--primary);
	}
}

.filterActive {
	border-color: var(--color--primary);
	background: var(--color--primary--tint-3, #fff5f0);
	color: var(--color--primary);
	font-weight: var(--font-weight--bold);
}

.filterCount {
	background: var(--color--primary);
	color: #fff;
	border-radius: 10px;
	padding: 0 6px;
	font-size: 11px;
	line-height: 16px;
}

.grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
	gap: var(--spacing--md);
}

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--spacing--md);
	padding: var(--spacing--3xl) var(--spacing--lg);
	text-align: center;
}

.emptyIcon {
	font-size: 48px;
}

.emptyTitle {
	font-size: var(--font-size--xl);
	font-weight: var(--font-weight--bold);
	color: var(--color--text-dark);
	margin: 0;
}

.emptyDesc {
	font-size: var(--font-size--sm);
	color: var(--color--text-base);
	line-height: 1.6;
	margin: 0;
}

/* ── Modals ── */
.overlay {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.5);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 2000;
	padding: var(--spacing--md);
}

.modal {
	background: var(--color--background-light);
	border-radius: var(--border-radius--large);
	padding: var(--spacing--lg);
	width: 100%;
	max-width: 600px;
	display: flex;
	flex-direction: column;
	gap: var(--spacing--md);
	max-height: 90vh;
	overflow: hidden;
}

.cvModal {
	max-width: 800px;
}

.modalHeader {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: var(--spacing--sm);
}

.modalHeaderActions {
	display: flex;
	align-items: center;
	gap: var(--spacing--xs);
}

.modalTitle {
	font-size: var(--font-size--xl);
	font-weight: var(--font-weight--bold);
	color: var(--color--text-dark);
	margin: 0;
}

.modalSubtitle {
	font-size: var(--font-size--sm);
	color: var(--color--text-base);
	margin: 2px 0 0;
}

.modalDesc {
	font-size: var(--font-size--sm);
	color: var(--color--text-base);
	line-height: 1.5;
	margin: 0;
}

.closeBtn {
	background: none;
	border: none;
	cursor: pointer;
	font-size: 18px;
	color: var(--color--text-base);
	padding: 2px 6px;
	border-radius: var(--border-radius--base);

	&:hover {
		background: var(--color--background-base);
	}
}

.jsonInput {
	width: 100%;
	font-family: var(--font-family--monospace);
	font-size: var(--font-size--xs);
	border: 1px solid var(--color--foreground-light);
	border-radius: var(--border-radius--base);
	padding: var(--spacing--sm);
	resize: vertical;
	background: var(--color--background-base);
	color: var(--color--text-dark);
	box-sizing: border-box;
}

.errorMsg {
	color: var(--color--danger);
	font-size: var(--font-size--sm);
	margin: 0;
}

.modalActions {
	display: flex;
	justify-content: flex-end;
	gap: var(--spacing--sm);
}

.cvContent {
	overflow-y: auto;
	white-space: pre-wrap;
	font-family: var(--font-family--monospace);
	font-size: var(--font-size--xs);
	line-height: 1.7;
	background: var(--color--background-base);
	border-radius: var(--border-radius--base);
	padding: var(--spacing--md);
	color: var(--color--text-dark);
	flex: 1;
	margin: 0;
}
</style>
