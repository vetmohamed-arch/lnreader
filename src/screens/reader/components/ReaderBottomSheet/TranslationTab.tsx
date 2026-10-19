import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';

import { Button, List } from '@components';
import { useChapterGeneralSettings, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { showToast } from '@utils/showToast';
import ReaderSheetPreferenceItem from './ReaderSheetPreferenceItem';

const TranslationTab: React.FC = () => {
  const theme = useTheme();
  const {
    translateToArabic,
    translationBilingual,
    translateOnDownload,
    translationGlossary,
    setChapterGeneralSettings,
  } = useChapterGeneralSettings();
  const [glossary, setGlossary] = useState(translationGlossary ?? '');

  const saveGlossary = () => {
    setChapterGeneralSettings({ translationGlossary: glossary });
    showToast(getString('readerScreen.translation.saved'));
  };

  return (
    <BottomSheetScrollView contentContainerStyle={styles.container}>
      <ReaderSheetPreferenceItem
        label={getString('readerScreen.translateToArabic')}
        description={getString('readerScreen.translation.engine')}
        value={Boolean(translateToArabic)}
        onPress={() =>
          setChapterGeneralSettings({ translateToArabic: !translateToArabic })
        }
        theme={theme}
      />
      <ReaderSheetPreferenceItem
        label={getString('readerScreen.translation.bilingual')}
        description={getString('readerScreen.translation.bilingualDescription')}
        value={Boolean(translationBilingual)}
        onPress={() =>
          setChapterGeneralSettings({
            translationBilingual: !translationBilingual,
          })
        }
        theme={theme}
      />
      <ReaderSheetPreferenceItem
        label={getString('readerScreen.translation.onDownload')}
        description={getString(
          'readerScreen.translation.onDownloadDescription',
        )}
        value={Boolean(translateOnDownload)}
        onPress={() =>
          setChapterGeneralSettings({
            translateOnDownload: !translateOnDownload,
          })
        }
        theme={theme}
      />
      <List.SubHeader theme={theme}>
        {getString('readerScreen.translation.glossary')}
      </List.SubHeader>
      <View style={styles.glossary}>
        <Text style={[styles.description, { color: theme.onSurfaceVariant }]}>
          {getString('readerScreen.translation.glossaryDescription')}
        </Text>
        <BottomSheetTextInput
          multiline
          value={glossary}
          onChangeText={setGlossary}
          placeholder={getString(
            'readerScreen.translation.glossaryPlaceholder',
          )}
          placeholderTextColor={theme.onSurfaceVariant}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.input,
            { color: theme.onSurface, borderColor: theme.outline },
          ]}
        />
        <Button
          mode="contained"
          title={getString('readerScreen.translation.save')}
          disabled={glossary === (translationGlossary ?? '')}
          onPress={saveGlossary}
        />
      </View>
    </BottomSheetScrollView>
  );
};

export default React.memo(TranslationTab);

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  glossary: { gap: 12, paddingHorizontal: 16 },
  description: { fontSize: 12 },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 140,
    padding: 12,
    textAlignVertical: 'top',
  },
});
