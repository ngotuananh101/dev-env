<template>
    <Dialog v-model:open="open">
        <DialogContent class="max-w-[500px] bg-[#252526] border-gray-700 text-gray-200">
            <DialogHeader>
                <DialogTitle>Download File</DialogTitle>
            </DialogHeader>

            <div class="space-y-4">
                <div class="space-y-2">
                    <Label>URL Address</Label>
                    <Input v-model="localUrl" placeholder="http://" @input="autoFillFilename" />
                </div>
                <div class="space-y-2">
                    <Label>Download To</Label>
                    <Input :model-value="currentPath" disabled />
                </div>
                <div class="space-y-2">
                    <Label>File Name</Label>
                    <Input v-model="localFileName" placeholder="Please Input" />
                </div>
            </div>

            <div v-if="downloading" class="mt-3">
                <div class="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Downloading...</span>
                    <span>{{ progress }}%</span>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-1.5">
                    <div class="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        :style="{ width: progress + '%' }"></div>
                </div>
            </div>

            <DialogFooter>
                <Button variant="secondary" size="sm" @click="cancel">Cancel</Button>
                <Button variant="success" size="sm" @click="confirm" :disabled="downloading">
                    {{ downloading ? 'Downloading...' : 'Confirm' }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const props = defineProps({
    currentPath: { type: String, default: '' },
    progress:    { type: Number, default: 0 },
    downloading: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'start-download']);

const open = ref(true);
const localUrl = ref('');
const localFileName = ref('');

watch(open, (v) => { if (!v) emit('close'); });

const autoFillFilename = () => {
    try {
        const urlObj = new URL(localUrl.value);
        const pathname = urlObj.pathname;
        const name = pathname.substring(pathname.lastIndexOf('/') + 1);
        if (name) localFileName.value = name;
    } catch (e) {}
};

const cancel = () => {
    emit('close', { cancel: true });
};

const confirm = () => {
    if (!localUrl.value || !localFileName.value) {
        alert('Please enter URL and File Name');
        return;
    }
    emit('start-download', { url: localUrl.value, fileName: localFileName.value });
};
</script>
