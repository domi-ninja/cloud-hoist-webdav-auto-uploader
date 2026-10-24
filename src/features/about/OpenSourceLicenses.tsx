import { useState } from 'react';
import { FlatList, Modal, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, FormField, IconAction } from '@/components/ui';
import inventory from '../../../assets/third-party-notices.json';

type LicensePackage = {
  name: string;
  version: string;
  license: string;
  source: string;
  textIds: string[];
};
const notices: { packages: LicensePackage[]; texts: Record<string, string> } = inventory;

export function OpenSourceLicenses() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string>();
  const query = search.trim().toLowerCase();
  const packages = notices.packages.filter(item => `${item.name} ${item.license}`.toLowerCase().includes(query));
  const close = () => {
    setOpen(false);
    setSearch('');
    setExpanded(undefined);
  };

  return (
    <>
      <View className="items-start">
        <ActionButton label="Open source licenses" icon="license" onPress={() => setOpen(true)} />
      </View>
      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
          <View className="gap-2 p-2">
            <View className="flex-row items-center gap-2">
              <IconAction icon="close" label="Close licenses" onPress={close} />
              <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">Open source licenses</Text>
            </View>
            <FormField label="Search libraries or licenses" value={search} onChangeText={setSearch} autoCapitalize="none" autoCorrect={false} />
          </View>
          <FlatList
            data={packages}
            keyExtractor={item => `${item.name}@${item.version}`}
            extraData={expanded}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-2 p-2"
            ListEmptyComponent={<Text className="text-base text-muted-light dark:text-muted-dark">No matching libraries</Text>}
            renderItem={({ item }) => {
              const key = `${item.name}@${item.version}`;
              const isExpanded = expanded === key;
              return (
                <View className="gap-2">
                  <ActionButton
                    label={`${item.name} ${item.version}`}
                    icon={isExpanded ? 'chevron-up' : 'chevron-down'}
                    accessibilityState={{ expanded: isExpanded }}
                    onPress={() => setExpanded(isExpanded ? undefined : key)}
                  />
                  <Text selectable className="text-base text-muted-light dark:text-muted-dark">{item.license}</Text>
                  {isExpanded ? (
                    <Text selectable className="text-base text-ink-light dark:text-ink-dark">{item.source}{'\n\n'}{item.textIds.map(id => notices.texts[id]).join('\n\n')}</Text>
                  ) : null}
                </View>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}
